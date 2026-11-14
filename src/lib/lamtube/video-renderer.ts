import "server-only";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import katex from "katex";
import { chromium } from "playwright";
import sharp from "sharp";
import type { LessonTimeline, Scene, VideoSettings } from "./model";
import { palette } from "./model";

export type RenderedMp4Result = {
  mp4Bytes: Buffer;
  captionsVtt: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  sizeBytes: number;
  codec: string;
  mimeType: string;
  digest: string;
};

type TimedPhrase = {
  sceneIndex: number;
  phraseIndex: number;
  text: string;
  start: number;
  end: number;
};

const CHROME_CANDIDATES = [
  process.env.LAMTUBE_CHROME_PATH?.trim(),
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim(),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((v): v is string => Boolean(v));

function ffmpegBinary(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

function ffprobeBinary(): string {
  return process.env.FFPROBE_PATH?.trim() || "ffprobe";
}

async function resolveChromeExecutable(): Promise<string | undefined> {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return undefined;
}

export function resolutionForAspect(aspect: VideoSettings["aspect"]): { width: number; height: number } {
  if (aspect === "9:16") return { width: 1080, height: 1920 };
  if (aspect === "1:1") return { width: 1080, height: 1080 };
  return { width: 1920, height: 1080 };
}

function formatVttTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms % 1000, 3)}`;
}

export function buildCaptionsVtt(phrases: TimedPhrase[]): string {
  const lines = ["WEBVTT", ""];
  for (let i = 0; i < phrases.length; i++) {
    const p = phrases[i];
    if (p.end <= p.start) continue;
    lines.push(`${i + 1}`);
    lines.push(`${formatVttTimestamp(p.start)} --> ${formatVttTimestamp(p.end)}`);
    lines.push(p.text.trim());
    lines.push("");
  }
  return lines.join("\n");
}

function runProcess(bin: string, args: string[], signal?: AbortSignal): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], signal });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => err.push(d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString("utf8") });
      else reject(new Error(`${bin} exited with ${code}: ${Buffer.concat(err).toString("utf8").slice(-600)}`));
    });
  });
}

async function concatAndMeasureAudio(
  workDir: string,
  clips: { sceneIndex: number; phraseIndex: number; text: string; bytes: Buffer }[],
  signal?: AbortSignal
): Promise<{ audioPath: string; totalDuration: number; phrases: TimedPhrase[] }> {
  if (!clips.length) throw new Error("Cannot assemble video audio with zero narration clips.");
  const clipPaths: string[] = [];
  const measuredDurations: number[] = [];

  for (let i = 0; i < clips.length; i++) {
    const p = path.join(workDir, `clip-${i}.wav`);
    await fs.writeFile(p, clips[i].bytes);
    clipPaths.push(p);
    const probe = await runProcess(
      ffprobeBinary(),
      ["-v", "quiet", "-print_format", "json", "-show_format", p],
      signal
    );
    const meta = JSON.parse(probe.stdout.toString("utf8")) as { format?: { duration?: string } };
    const dur = Number(meta.format?.duration ?? 0);
    if (!Number.isFinite(dur) || dur <= 0.05) {
      throw new Error(`Narration clip ${i} has invalid audio duration (${dur}).`);
    }
    measuredDurations.push(dur);
  }

  // Insert short 140ms breathing gap between phrases and 280ms between scenes so narration paces cleanly.
  const silenceShort = path.join(workDir, "gap-short.wav");
  const silenceScene = path.join(workDir, "gap-scene.wav");
  await runProcess(
    ffmpegBinary(),
    ["-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "0.14", "-c:a", "pcm_s16le", silenceShort],
    signal
  );
  await runProcess(
    ffmpegBinary(),
    ["-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "0.32", "-c:a", "pcm_s16le", silenceScene],
    signal
  );

  // Build normalized stereo 48kHz intermediates + concat list for exact sample sync.
  const normList: string[] = [];
  const phrases: TimedPhrase[] = [];
  let cursor = 0;

  for (let i = 0; i < clips.length; i++) {
    const normClip = path.join(workDir, `norm-${i}.wav`);
    await runProcess(
      ffmpegBinary(),
      [
        "-y",
        "-i",
        clipPaths[i],
        "-af",
        "aresample=48000,pan=stereo|c0=c0|c1=c0,dynaudnorm=f=150:g=15:p=0.92",
        "-c:a",
        "pcm_s16le",
        normClip,
      ],
      signal
    );
    const actualStart = cursor;
    const dur = measuredDurations[i];
    phrases.push({
      sceneIndex: clips[i].sceneIndex,
      phraseIndex: clips[i].phraseIndex,
      text: clips[i].text,
      start: actualStart,
      end: actualStart + dur,
    });
    normList.push(`file '${normClip.replace(/'/g, "'\\''")}'`);
    cursor += dur;

    const next = clips[i + 1];
    if (next) {
      const gapFile = next.sceneIndex !== clips[i].sceneIndex ? silenceScene : silenceShort;
      const gapDur = next.sceneIndex !== clips[i].sceneIndex ? 0.32 : 0.14;
      normList.push(`file '${gapFile.replace(/'/g, "'\\''")}'`);
      cursor += gapDur;
    }
  }

  const concatTxt = path.join(workDir, "concat.txt");
  await fs.writeFile(concatTxt, normList.join("\n"), "utf8");
  const masterWav = path.join(workDir, "master.wav");
  await runProcess(
    ffmpegBinary(),
    ["-y", "-f", "concat", "-safe", "0", "-i", concatTxt, "-c:a", "pcm_s16le", masterWav],
    signal
  );

  const masterProbe = await runProcess(
    ffprobeBinary(),
    ["-v", "quiet", "-print_format", "json", "-show_format", masterWav],
    signal
  );
  const masterMeta = JSON.parse(masterProbe.stdout.toString("utf8")) as { format?: { duration?: string } };
  const totalDuration = Math.max(cursor, Number(masterMeta.format?.duration ?? cursor));

  return { audioPath: masterWav, totalDuration, phrases };
}

/** Rewrite scene starts/durations to match exact concatenated PCM phrase timestamps. */
function resyncTimelineToAudio(timeline: LessonTimeline, phrases: TimedPhrase[], totalDuration: number): LessonTimeline {
  const byScene = new Map<number, TimedPhrase[]>();
  for (const p of phrases) {
    const arr = byScene.get(p.sceneIndex) ?? [];
    arr.push(p);
    byScene.set(p.sceneIndex, arr);
  }
  const scenes: Scene[] = timeline.scenes.map((scene, idx) => {
    const sp = byScene.get(idx) ?? [];
    if (!sp.length) return scene;
    const start = sp[0].start;
    const nextSceneStart = byScene.get(idx + 1)?.[0]?.start ?? totalDuration;
    const duration = Math.max(0.5, nextSceneStart - start);
    const clips = scene.clips.map((c, j) => ({
      ...c,
      duration: sp[j] ? sp[j].end - sp[j].start : c.duration,
    }));
    return { ...scene, start, duration, clips };
  });
  return { version: 1, duration: totalDuration, scenes };
}

function buildKatexCssWithEmbeddedFonts(): string {
  const katexCssPath = require.resolve("katex/dist/katex.min.css");
  const fontsDir = path.join(path.dirname(katexCssPath), "fonts");
  let css = "";
  // Synchronous read in server helper for deterministic asset bundling.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeFs = require("node:fs") as typeof import("node:fs");
  css = nodeFs.readFileSync(katexCssPath, "utf8");
  return css.replace(/url\(fonts\/([^)]+\.woff2)\)/g, (full, file: string) => {
    try {
      const b64 = nodeFs.readFileSync(path.join(fontsDir, file)).toString("base64");
      return `url(data:font/woff2;base64,${b64})`;
    } catch {
      return full;
    }
  });
}

function preRenderKatexMarkup(timeline: LessonTimeline, isLight: boolean): Record<string, { html: string; width: number }> {
  const result: Record<string, { html: string; width: number }> = {};
  const ink = isLight ? "#0f172a" : "#eef6ff";
  for (const scene of timeline.scenes) {
    for (const el of scene.elements) {
      if (el.kind !== "latex" && !(el.kind === "equation" && el.latex)) continue;
      const expr = (el.latex || el.text || "").trim();
      if (!expr || result[expr]) continue;
      try {
        const rendered = katex.renderToString(expr, {
          displayMode: true,
          throwOnError: false,
          strict: false,
        });
        result[expr] = {
          html: `<div style="color:${ink};font-size:34px;line-height:1.25;padding:12px 22px;display:inline-block;">${rendered}</div>`,
          width: Math.max(220, el.w || 380),
        };
      } catch {
        // fallback handled cleanly in canvas text renderer
      }
    }
  }
  return result;
}

function compositorHtml(payload: {
  timeline: LessonTimeline;
  phrases: TimedPhrase[];
  settings: VideoSettings;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  katexCss: string;
  katexItems: Record<string, { html: string; width: number }>;
  assetDataUrls: Record<string, string>;
  paletteColors: Record<string, string>;
}): string {
  // Serialize strictly without script tags inside payload.
  const safeJson = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
${payload.katexCss}
html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }
#katex-stage { position: fixed; left: -9999px; top: 0; pointer-events: none; }
</style>
</head>
<body>
<div id="katex-stage"></div>
<canvas id="stage" width="${payload.width}" height="${payload.height}"></canvas>
<script>
window.__LAMTUBE_BOOT__ = async function(postUrl) {
  const DATA = ${safeJson};
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d", { alpha: false });
  const W = DATA.width;
  const H = DATA.height;
  const FPS = DATA.fps;
  const isLight = DATA.settings.style === "whiteboard";
  const PALETTE = DATA.paletteColors;

  function colorFor(key) {
    if (isLight) {
      const map = { white: "#0f172a", muted: "#475569", cyan: "#0284c7", blue: "#2563eb", violet: "#7c3aed", green: "#059669", amber: "#d97706", red: "#e11d48" };
      return map[key] || "#0284c7";
    }
    return PALETTE[key] || "#67e8f9";
  }

  // 1. Wait for embedded KaTeX .woff2 fonts so Canvas 2D renders authentic math typography with zero SVG tainting
  try { await document.fonts.ready; } catch {}

  const TEX_MAP = {
    theta: "θ", alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ",
    pi: "π", lambda: "λ", omega: "ω", sigma: "σ", mu: "μ", phi: "φ", epsilon: "ε",
    times: "×", cdot: "·", pm: "±", rightarrow: "→", to: "→", leftarrow: "←",
    leftrightarrow: "↔", le: "≤", leq: "≤", ge: "≥", geq: "≥", approx: "≈",
    neq: "≠", infty: "∞", circ: "°", degree: "°", sum: "Σ", int: "∫",
    sin: "sin", cos: "cos", tan: "tan", sec: "sec", csc: "csc", cot: "cot",
    log: "log", ln: "ln", lim: "lim", max: "max", min: "min"
  };

  function normalizeTexTokens(raw) {
    let s = String(raw || "");
    s = s.replace(/\\\\(?:text|mathrm|mathbf|operatorname)\{([^}]*)\}/g, "$1");
    s = s.replace(/\\\\(left|right|quad|qquad|,|;)/g, "");
    s = s.replace(/\\\\([a-zA-Z]+)/g, (m, cmd) => {
      if (cmd === "frac" || cmd === "sqrt") return m;
      return Object.prototype.hasOwnProperty.call(TEX_MAP, cmd) ? TEX_MAP[cmd] : cmd;
    });
    return s;
  }

  function parseMathSeq(src, pos, stopChar) {
    const nodes = [];
    while (pos < src.length) {
      const ch = src[pos];
      if (stopChar && ch === stopChar) return { nodes, pos: pos + 1 };
      if (src.startsWith("\\\\frac{", pos)) {
        const num = parseMathSeq(src, pos + 6, "}");
        if (src[num.pos] === "{") {
          const den = parseMathSeq(src, num.pos + 1, "}");
          nodes.push({ t: "frac", num: num.nodes, den: den.nodes });
          pos = den.pos;
          continue;
        }
      }
      if (src.startsWith("\\\\sqrt{", pos)) {
        const inner = parseMathSeq(src, pos + 6, "}");
        nodes.push({ t: "sqrt", inner: inner.nodes });
        pos = inner.pos;
        continue;
      }
      if (ch === "^" || ch === "_") {
        const kind = ch === "^" ? "sup" : "sub";
        pos++;
        let subNodes = [];
        if (src[pos] === "{") {
          const inner = parseMathSeq(src, pos + 1, "}");
          subNodes = inner.nodes;
          pos = inner.pos;
        } else if (pos < src.length) {
          subNodes = [{ t: "txt", v: src[pos] }];
          pos++;
        }
        nodes.push({ t: kind, inner: subNodes });
        continue;
      }
      if (ch === "{") {
        const inner = parseMathSeq(src, pos + 1, "}");
        nodes.push(...inner.nodes);
        pos = inner.pos;
        continue;
      }
      let txt = "";
      while (pos < src.length && !["^", "_", "{", stopChar].includes(src[pos]) && !src.startsWith("\\\\frac{", pos) && !src.startsWith("\\\\sqrt{", pos)) {
        txt += src[pos++];
      }
      if (txt) nodes.push({ t: "txt", v: txt });
      else if (pos < src.length) pos++;
    }
    return { nodes, pos };
  }

  function measureMath(nodes, fpx) {
    let w = 0, maxH = fpx * 1.25;
    for (const n of nodes) {
      if (n.t === "txt") {
        ctx.font = '600 ' + fpx + 'px "KaTeX_Main", "Cambria Math", Georgia, serif';
        w += ctx.measureText(n.v).width;
      } else if (n.t === "sup" || n.t === "sub") {
        const m = measureMath(n.inner, fpx * 0.68);
        w += m.w + 2;
        maxH = Math.max(maxH, fpx * 1.45);
      } else if (n.t === "frac") {
        const m1 = measureMath(n.num, fpx * 0.82);
        const m2 = measureMath(n.den, fpx * 0.82);
        w += Math.max(m1.w, m2.w) + 14;
        maxH = Math.max(maxH, m1.h + m2.h + 12);
      } else if (n.t === "sqrt") {
        const mi = measureMath(n.inner, fpx * 0.9);
        w += mi.w + fpx * 0.65;
        maxH = Math.max(maxH, mi.h + 8);
      }
    }
    return { w, h: maxH };
  }

  function drawMathNodes(nodes, x, cy, fpx, col) {
    let cx = x;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (const n of nodes) {
      if (n.t === "txt") {
        const parts = n.v.split(/([a-zA-Z]+)/);
        for (const p of parts) {
          if (!p) continue;
          const isWordFn = /^(sin|cos|tan|sec|csc|cot|log|ln|lim|max|min|kg|cm|km|mol)$/i.test(p);
          const isVar = /^[a-zA-Z]+$/.test(p) && p.length <= 2 && !isWordFn;
          ctx.font = (isVar ? 'italic 600 ' : '600 ') + fpx + 'px "KaTeX_Math", "KaTeX_Main", "Cambria Math", Georgia, serif';
          ctx.fillStyle = col;
          ctx.fillText(p, cx, cy);
          cx += ctx.measureText(p).width;
        }
      } else if (n.t === "sup") {
        const subF = fpx * 0.68;
        const m = measureMath(n.inner, subF);
        drawMathNodes(n.inner, cx + 1, cy - fpx * 0.34, subF, col);
        cx += m.w + 2;
      } else if (n.t === "sub") {
        const subF = fpx * 0.68;
        const m = measureMath(n.inner, subF);
        drawMathNodes(n.inner, cx + 1, cy + fpx * 0.28, subF, col);
        cx += m.w + 2;
      } else if (n.t === "frac") {
        const fSub = fpx * 0.82;
        const m1 = measureMath(n.num, fSub);
        const m2 = measureMath(n.den, fSub);
        const fw = Math.max(m1.w, m2.w) + 10;
        drawMathNodes(n.num, cx + (fw - m1.w) / 2, cy - m1.h * 0.48, fSub, col);
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1.8, fpx * 0.065);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + fw, cy); ctx.stroke();
        drawMathNodes(n.den, cx + (fw - m2.w) / 2, cy + m2.h * 0.5, fSub, col);
        cx += fw + 4;
      } else if (n.t === "sqrt") {
        const fSub = fpx * 0.9;
        const mi = measureMath(n.inner, fSub);
        const hookW = fpx * 0.45;
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1.8, fpx * 0.065);
        ctx.beginPath();
        ctx.moveTo(cx + hookW * 0.1, cy + 2);
        ctx.lineTo(cx + hookW * 0.45, cy + mi.h * 0.38);
        ctx.lineTo(cx + hookW, cy - mi.h * 0.42);
        ctx.lineTo(cx + hookW + mi.w + 6, cy - mi.h * 0.42);
        ctx.stroke();
        drawMathNodes(n.inner, cx + hookW + 3, cy + 2, fSub, col);
        cx += hookW + mi.w + 8;
      }
    }
  }

  // 2. Decode AI illustration plates into ImageBitmaps
  const assetBitmaps = {};
  for (const [key, dataUrl] of Object.entries(DATA.assetDataUrls)) {
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      assetBitmaps[key] = img;
    } catch {}
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function easeOutCubic(t) { t = clamp01(t); return 1 - Math.pow(1 - t, 3); }
  function easeInOutSine(t) { t = clamp01(t); return -(Math.cos(Math.PI * t) - 1) / 2; }

  // World coordinate (0..1000 x 0..1000) -> pixel mapping utilizing widescreen 16:9 breadth cleanly
  const padX = W * 0.04;
  const padTop = H * 0.09;
  const padBottom = DATA.settings.captions ? H * 0.14 : H * 0.05;
  const boardW = W - padX * 2;
  const boardH = H - padTop - padBottom;
  const scaleX = boardW / 1000;
  const scaleY = boardH / 1000;
  const uniformScale = Math.min(scaleX, scaleY);
  const layoutScaleX = Math.min(scaleX, uniformScale * 1.48);
  const offsetX = padX + (boardW - 1000 * layoutScaleX) / 2;
  const offsetY = padTop + (boardH - 1000 * uniformScale) / 2;
  const wx = (x) => offsetX + x * layoutScaleX;
  const wy = (y) => offsetY + y * uniformScale;
  const ws = (v) => v * uniformScale;
  const wsX = (v) => v * layoutScaleX;

  function drawRoundedRect(x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function wrapLines(text, maxWidth, fontPx) {
    ctx.font = '600 ' + fontPx + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
    const words = String(text || "").split(/\\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width <= maxWidth || !cur) cur = test;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }

  function sampleTargetCurvePx(scene, targetId, prog) {
    const tgt = scene.elements.find((e) => e.id === targetId);
    if (!tgt) return null;
    const tpx = wx(tgt.x), tpy = wy(tgt.y), tpw = wsX(tgt.w), tph = ws(tgt.h);
    if (tgt.kind === "plot" && Array.isArray(tgt.curve) && tgt.curve.length >= 2) {
      const innerL = tpx + ws(56), innerR = tpx + tpw - ws(26), innerT = tpy + ws(28), innerB = tpy + tph - ws(44);
      const iw = Math.max(40, innerR - innerL), ih = Math.max(40, innerB - innerT);
      const dataMinX = Math.min(...tgt.curve.map(p => p.x));
      const dataMaxX = Math.max(...tgt.curve.map(p => p.x));
      const dataMinY = Math.min(...tgt.curve.map(p => p.y));
      const dataMaxY = Math.max(...tgt.curve.map(p => p.y));
      const minX = tgt.xRange ? Math.min(tgt.xRange[0], dataMinX) : dataMinX;
      const maxX = tgt.xRange ? Math.max(tgt.xRange[1], dataMaxX) : dataMaxX;
      const minY = tgt.yRange ? Math.min(tgt.yRange[0], dataMinY) : dataMinY;
      const maxY = tgt.yRange ? Math.max(tgt.yRange[1], dataMaxY) : dataMaxY;
      const f = prog * (tgt.curve.length - 1);
      const i0 = Math.min(tgt.curve.length - 2, Math.floor(f));
      const frac = f - i0;
      const p0 = tgt.curve[i0], p1 = tgt.curve[i0 + 1];
      const vx = p0.x + (p1.x - p0.x) * frac;
      const vy = p0.y + (p1.y - p0.y) * frac;
      const nx = (vx - minX) / (maxX - minX || 1);
      const ny = (vy - minY) / (maxY - minY || 1);
      return { x: innerL + nx * iw, y: innerB - ny * ih };
    }
    if ((tgt.kind === "graph" || tgt.kind === "sketch") && Array.isArray(tgt.points) && tgt.points.length >= 2) {
      const f = prog * (tgt.points.length - 1);
      const i0 = Math.min(tgt.points.length - 2, Math.floor(f));
      const frac = f - i0;
      const p0 = tgt.points[i0], p1 = tgt.points[i0 + 1];
      const px0 = p0.x + (p1.x - p0.x) * frac;
      const py0 = p0.y + (p1.y - p0.y) * frac;
      return { x: tpx + (px0 / 1000) * tpw, y: tpy + (py0 / 1000) * tph };
    }
    return null;
  }

  function phraseSpan(scene, sceneIndex, pIdx) {
    const list = DATA.phrases.filter((p) => p.sceneIndex === sceneIndex);
    const hit = list.find((p) => p.phraseIndex === pIdx);
    if (hit) return { start: hit.start, dur: Math.max(0.2, hit.end - hit.start) };
    const slice = scene.duration / Math.max(1, scene.phrases.length);
    return { start: scene.start + pIdx * slice, dur: slice };
  }

  function evaluateElementMotion(scene, sceneIndex, el, t) {
    const rel = scene.cues.filter((c) => c.element === el.id);
    if (!rel.length) return { alpha: 1, draw: 1, dx: 0, dy: 0, scale: 1, pulse: 0, orbitAngle: (t - scene.start) * 1.4, pathPos: null, scaleVX: 1, scaleVY: 1 };
    let alpha = 0, draw = 0, dx = 0, dy = 0, scale = 1, pulse = 0, scaleVX = 1, scaleVY = 1;
    let pathPos = null;
    for (const c of rel) {
      const span = phraseSpan(scene, sceneIndex, c.phrase);
      const cStart = span.start + c.offset * span.dur;
      const cDur = Math.max(0.25, c.duration * span.dur);
      const p = clamp01((t - cStart) / cDur);
      const ep = easeOutCubic(p);
      if (p > 0) alpha = Math.max(alpha, Math.min(1, p * 3.5));
      if (c.effect === "draw") {
        draw = Math.max(draw, ep);
        scaleVX = ep; scaleVY = ep;
      } else if (c.effect === "scaleVector") {
        draw = Math.max(draw, ep);
        scaleVX = 0.25 + ((c.scaleX || 1) - 0.25) * ep + (1 - 0.25) * 0;
        scaleVY = 0.25 + ((c.scaleY || 1) - 0.25) * ep;
        if (c.scaleX == null) scaleVX = ep;
        if (c.scaleY == null) scaleVY = ep;
      } else if (c.effect === "move") {
        draw = Math.max(draw, p > 0 ? 1 : 0);
        dx += (c.dx || 0) * easeInOutSine(p);
        dy += (c.dy || 0) * easeInOutSine(p);
      } else if (c.effect === "followPath" && c.target && p > 0) {
        draw = 1;
        pathPos = sampleTargetCurvePx(scene, c.target, easeInOutSine(p)) || pathPos;
      } else if (c.effect === "pulse" || c.effect === "highlight") {
        draw = Math.max(draw, p > 0 ? 1 : 0);
        if (p > 0 && p < 1) pulse = Math.max(pulse, Math.sin(p * Math.PI));
      } else {
        draw = Math.max(draw, p > 0 ? 1 : 0);
        if (p > 0 && p < 1) scale = 0.94 + 0.06 * ep;
      }
    }
    return { alpha, draw: Math.max(alpha > 0 ? 0.02 : 0, draw), dx, dy, scale, pulse, orbitAngle: (t - scene.start) * 1.4, pathPos, scaleVX, scaleVY };
  }

  function drawArrow(x1, y1, x2, y2, col, lineWidth) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 3) return;
    const head = Math.min(20, Math.max(10, len * 0.16));
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - Math.cos(ang) * head * 0.65, y2 - Math.sin(ang) * head * 0.65);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function renderBackground(sceneProg) {
    if (isLight) {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#f8fafc");
      grad.addColorStop(1, "#e2e8f0");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(15, 23, 42, 0.045)";
    } else {
      const grad = ctx.createRadialGradient(W * 0.25, H * 0.2, W * 0.05, W * 0.55, H * 0.55, W * 0.9);
      grad.addColorStop(0, "#0f1e3d");
      grad.addColorStop(0.55, "#091227");
      grad.addColorStop(1, "#050914");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.065)";
    }
    // Crisp technical graph paper micro-grid inside board area
    ctx.lineWidth = 1;
    const step = ws(50);
    const gx0 = wx(0), gy0 = wy(0), gx1 = wx(1000), gy1 = wy(1000);
    ctx.beginPath();
    for (let x = gx0; x <= gx1; x += step) { ctx.moveTo(x, gy0); ctx.lineTo(x, gy1); }
    for (let y = gy0; y <= gy1; y += step) { ctx.moveTo(gx0, y); ctx.lineTo(gx1, y); }
    ctx.stroke();

    // Subtle animated progress rail along the very top
    ctx.fillStyle = isLight ? "rgba(2,132,199,0.85)" : "rgba(103,232,249,0.85)";
    ctx.fillRect(0, 0, W * clamp01(sceneProg), Math.max(4, Math.round(H * 0.004)));
  }

  function renderHeader(scene, sceneIndex) {
    const topY = Math.round(H * 0.022);
    const badgeH = Math.round(H * 0.042);
    const fontMeta = Math.round(badgeH * 0.44);
    const fontTitle = Math.round(badgeH * 0.62);

    ctx.save();
    drawRoundedRect(padX, topY, Math.min(W * 0.26, 260), badgeH, badgeH / 2);
    ctx.fillStyle = isLight ? "rgba(2, 132, 199, 0.12)" : "rgba(103, 232, 249, 0.14)";
    ctx.fill();
    ctx.strokeStyle = isLight ? "rgba(2, 132, 199, 0.35)" : "rgba(103, 232, 249, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = colorFor("cyan");
    ctx.font = '700 ' + fontMeta + 'px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("SCENE " + (sceneIndex + 1) + " OF " + DATA.timeline.scenes.length, padX + 18, topY + badgeH / 2);

    ctx.fillStyle = isLight ? "#0f172a" : "#f1f5f9";
    ctx.font = '700 ' + fontTitle + 'px system-ui, -apple-system, sans-serif';
    const titleX = padX + Math.min(W * 0.26, 260) + 20;
    const maxTitleW = W - titleX - padX;
    let title = scene.title;
    while (ctx.measureText(title).width > maxTitleW && title.length > 8) title = title.slice(0, -2) + "…";
    ctx.fillText(title, titleX, topY + badgeH / 2);
    ctx.restore();
  }

  function renderElement(scene, sceneIndex, el, t) {
    const m = evaluateElementMotion(scene, sceneIndex, el, t);
    if (m.alpha <= 0.01) return;

    const keepUniform = ["circle", "atom"].includes(el.kind);
    const pw = el.kind === "atom" ? Math.max(ws(210), ws(el.w)) : keepUniform ? ws(el.w) : wsX(el.w);
    const ph = el.kind === "atom" ? Math.max(ws(210), ws(el.h)) : ws(el.h);
    const px = m.pathPos ? (m.pathPos.x - pw / 2 + wsX(m.dx)) : wx(el.x + m.dx);
    const py = m.pathPos ? (m.pathPos.y - ph / 2 + ws(m.dy)) : wy(el.y + m.dy);
    const col = colorFor(el.color);

    ctx.save();
    ctx.globalAlpha = m.alpha;

    if (m.scale !== 1 && !["plot", "graph", "arrow", "illustration"].includes(el.kind)) {
      const cx = px + pw / 2, cy = py + ph / 2;
      ctx.translate(cx, cy);
      ctx.scale(m.scale, m.scale);
      ctx.translate(-cx, -cy);
    }

    if (m.pulse > 0.05) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 18 * m.pulse;
    }

    if (el.kind === "illustration") {
      const bmp = el.assetKey ? assetBitmaps[el.assetKey] : null;
      if (bmp) {
        const rw = Math.max(ws(120), pw), rh = Math.max(ws(100), ph);
        drawRoundedRect(px, py, rw, rh, 18);
        ctx.save();
        ctx.clip();
        const s = 1 + 0.04 * clamp01((t - scene.start) / Math.max(1, scene.duration));
        ctx.drawImage(bmp, px - (rw * (s - 1)) / 2, py - (rh * (s - 1)) / 2, rw * s, rh * s);
        ctx.restore();
        ctx.strokeStyle = isLight ? "rgba(15,23,42,0.18)" : "rgba(148,163,184,0.28)";
        ctx.lineWidth = 2;
        drawRoundedRect(px, py, rw, rh, 18);
        ctx.stroke();
      } else {
        // Subtle radial glow backdrop instead of an empty wireframe rectangle when no raster plate is present
        const cx = px + pw / 2, cy = py + ph / 2;
        const rad = Math.max(ws(120), Math.min(pw, ph) * 0.55);
        const aura = ctx.createRadialGradient(cx, cy, 4, cx, cy, rad);
        aura.addColorStop(0, col + "1c");
        aura.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      }
    } else if (el.kind === "rect") {
      drawRoundedRect(px, py, pw, ph, 14);
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.88)" : "rgba(15, 23, 42, 0.72)";
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (el.text) {
        const fpx = Math.max(16, Math.round(ws(23)));
        const lines = wrapLines(el.text, Math.max(60, pw - ws(24)), fpx);
        ctx.fillStyle = isLight ? "#0f172a" : "#e2e8f0";
        ctx.font = '600 ' + fpx + 'px system-ui, -apple-system, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const lh = fpx * 1.25;
        const startY = py + ph / 2 - ((lines.length - 1) * lh) / 2;
        lines.forEach((ln, idx) => ctx.fillText(ln, px + pw / 2, startY + idx * lh));
      }
    } else if (el.kind === "circle") {
      const rx = Math.max(10, pw / 2), ry = Math.max(10, ph / 2);
      const cx = px + rx, cy = py + ry;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? "rgba(2,132,199,0.14)" : "rgba(103,232,249,0.18)";
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.stroke();
      if (el.text) {
        ctx.fillStyle = isLight ? "#0f172a" : "#ffffff";
        ctx.font = '700 ' + Math.max(15, Math.round(ws(21))) + 'px system-ui, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.text, cx, cy);
      }
    } else if (el.kind === "highlight") {
      drawRoundedRect(px, py, pw, ph, 14);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col + "22";
      ctx.fill();
    } else if (el.kind === "arrow") {
      const sx = px, sy = py;
      const exPos = px + pw * m.scaleVX * m.draw;
      const eyPos = py + ph * m.scaleVY * m.draw;
      drawArrow(sx, sy, exPos, eyPos, col, Math.max(3, ws(4)));
      if (el.text && m.draw > 0.35) {
        const mx = (sx + exPos) / 2, my = (sy + eyPos) / 2;
        ctx.fillStyle = col;
        ctx.font = '700 ' + Math.max(16, Math.round(ws(22))) + 'px system-ui, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(el.text, mx, my - 10);
      }
    } else if (el.kind === "label") {
      const fpx = Math.max(18, Math.round(ws(25)));
      const lines = wrapLines(el.text, Math.max(wsX(280), pw), fpx);
      ctx.fillStyle = el.color === "white" ? (isLight ? "#0f172a" : "#f8fafc") : col;
      ctx.font = '700 ' + fpx + 'px system-ui, -apple-system, sans-serif';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      lines.forEach((ln, idx) => ctx.fillText(ln, px, py + idx * fpx * 1.28));
    } else if (el.kind === "latex" || el.kind === "equation") {
      const expr = (el.latex || el.text || "").trim();
      const fpx = Math.max(22, Math.round(ws(28)));
      const normalized = normalizeTexTokens(expr);
      const parsed = parseMathSeq(normalized, 0, null).nodes;
      const mMath = measureMath(parsed, fpx);
      const maxCardW = Math.max(pw, 320);
      const scale = mMath.w > maxCardW - 36 ? Math.max(0.62, (maxCardW - 36) / mMath.w) : 1;
      const drawFpx = fpx * scale;
      const mScaled = scale === 1 ? mMath : measureMath(parsed, drawFpx);
      const boxW = Math.max(pw, Math.min(maxCardW + 80, mScaled.w + 42));
      const boxH = Math.max(ph, mScaled.h + 26);

      drawRoundedRect(px, py, boxW, boxH, 16);
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.94)" : "rgba(10, 20, 44, 0.88)";
      ctx.fill();
      ctx.strokeStyle = col + "88";
      ctx.lineWidth = 2.2;
      ctx.stroke();

      drawMathNodes(parsed, px + (boxW - mScaled.w) / 2, py + boxH / 2, drawFpx, isLight ? "#0f172a" : col);
    } else if (el.kind === "plot") {
      drawRoundedRect(px, py, pw, ph, 16);
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.88)" : "rgba(7, 15, 34, 0.84)";
      ctx.fill();
      ctx.strokeStyle = isLight ? "rgba(15,23,42,0.18)" : "rgba(148,163,184,0.28)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const curve = Array.isArray(el.curve) && el.curve.length >= 2 ? el.curve : [];
      if (curve.length < 2) {
        // Container-only plot card with no curve data: omit empty Cartesian axes so foreground diagrams read clearly
      } else {
        const innerL = px + ws(56), innerR = px + pw - ws(26), innerT = py + ws(28), innerB = py + ph - ws(44);
        const iw = Math.max(40, innerR - innerL), ih = Math.max(40, innerB - innerT);
        const dataMinX = Math.min(...curve.map(p => p.x));
        const dataMaxX = Math.max(...curve.map(p => p.x));
        const dataMinY = Math.min(...curve.map(p => p.y));
        const dataMaxY = Math.max(...curve.map(p => p.y));
        const minX = el.xRange ? Math.min(el.xRange[0], dataMinX) : dataMinX;
        const maxX = el.xRange ? Math.max(el.xRange[1], dataMaxX) : dataMaxX;
        const minY = el.yRange ? Math.min(el.yRange[0], dataMinY) : dataMinY;
        const maxY = el.yRange ? Math.max(el.yRange[1], dataMaxY) : dataMaxY;

        // Grid lines
        ctx.strokeStyle = isLight ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.14)";
        ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) {
          const gx = innerL + (iw * g) / 4;
          const gy = innerT + (ih * g) / 4;
          ctx.beginPath(); ctx.moveTo(gx, innerT); ctx.lineTo(gx, innerB); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(innerL, gy); ctx.lineTo(innerR, gy); ctx.stroke();
        }

        // Main Axes (highlight x=0 or y=0 if inside range, else bottom/left border axes)
        const zeroY = (minY <= 0 && maxY >= 0) ? innerB - ((0 - minY) / (maxY - minY || 1)) * ih : innerB;
        const zeroX = (minX <= 0 && maxX >= 0) ? innerL + ((0 - minX) / (maxX - minX || 1)) * iw : innerL;
        const axisCol = isLight ? "#334155" : "#94a3b8";
        drawArrow(innerL - 8, zeroY, innerR + 10, zeroY, axisCol, 2);
        drawArrow(zeroX, innerB + 8, zeroX, innerT - 10, axisCol, 2);

        // Axis labels & crisp non-colliding range ticks
        ctx.fillStyle = axisCol;
        ctx.font = '600 ' + Math.max(13, Math.round(ws(17))) + 'px system-ui, sans-serif';
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText(el.axisX || "x", innerR, innerB + 10);
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(el.axisY || "y", zeroX + 12, innerT - 4);
        ctx.font = '500 ' + Math.max(11, Math.round(ws(13))) + 'px system-ui, sans-serif';
        ctx.fillStyle = isLight ? "rgba(51,65,85,0.75)" : "rgba(148,163,184,0.72)";
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText(String(Number(minX.toFixed(1))), innerL, innerB + 8);
        ctx.textAlign = "right";
        ctx.fillText(String(Number(maxX.toFixed(1))), innerR - ws(34), innerB + 8);
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(String(Number(maxY.toFixed(1))), innerL - 10, innerT + 14);
        ctx.fillText(String(Number(minY.toFixed(1))), innerL - 10, innerB - 6);

        // Smooth Animated Curve Trace clipped cleanly inside plot bounds
        ctx.save();
        ctx.beginPath();
        ctx.rect(innerL - 4, innerT - 4, iw + 8, ih + 8);
        ctx.clip();
        const mapped = curve.map((pt) => ({
          x: innerL + ((pt.x - minX) / (maxX - minX || 1)) * iw,
          y: innerB - ((pt.y - minY) / (maxY - minY || 1)) * ih,
        }));
        const exactMax = Math.max(1, Math.min(mapped.length - 1, Math.floor((mapped.length - 1) * m.draw)));
        const sub = mapped.slice(0, exactMax + 1);
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(3, ws(4.5));
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sub[0].x, sub[0].y);
        if (sub.length === 2) {
          ctx.lineTo(sub[1].x, sub[1].y);
        } else {
          for (let i = 1; i < sub.length - 1; i++) {
            const xc = (sub[i].x + sub[i + 1].x) / 2;
            const yc = (sub[i].y + sub[i + 1].y) / 2;
            ctx.quadraticCurveTo(sub[i].x, sub[i].y, xc, yc);
          }
          const last = sub[sub.length - 1];
          ctx.lineTo(last.x, last.y);
        }
        ctx.stroke();

        // Glowing tracer dot at curve frontier
        const tip = sub[sub.length - 1];
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(tip.x, tip.y, ws(6), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else if (el.kind === "graph" || el.kind === "sketch") {
      if (el.kind === "graph") {
        ctx.strokeStyle = isLight ? "#475569" : "#64748b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(px, py + ph); ctx.lineTo(px + pw, py + ph);
        ctx.stroke();
      }
      const pts = el.points || [];
      if (pts.length >= 2) {
        const maxIdx = Math.max(1, Math.min(pts.length - 1, Math.floor((pts.length - 1) * m.draw)));
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(3, ws(4));
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i <= maxIdx; i++) {
          const sx = px + (pts[i].x / 1000) * pw;
          const sy = py + (pts[i].y / 1000) * ph;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
    } else if (el.kind === "atom") {
      const cx = px + pw / 2, cy = py + ph / 2;
      const maxR = Math.min(pw, ph) * 0.46;
      const shells = Array.isArray(el.shells) && el.shells.length ? el.shells : [2, 8, 1];
      const nucR = Math.max(ws(18), maxR * 0.24);

      // Orbit rings & rotating electrons
      shells.forEach((count, sIdx) => {
        const ringR = nucR + ((maxR - nucR) * (sIdx + 1)) / shells.length;
        ctx.strokeStyle = isLight ? "rgba(37,99,235,0.28)" : "rgba(148,163,184,0.34)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        const speed = (sIdx % 2 === 0 ? 1 : -1) * (0.9 + sIdx * 0.35);
        for (let e = 0; e < count; e++) {
          const ang = (Math.PI * 2 * e) / count + m.orbitAngle * speed;
          const exPos = cx + Math.cos(ang) * ringR;
          const eyPos = cy + Math.sin(ang) * ringR;
          ctx.fillStyle = colorFor("cyan");
          ctx.beginPath(); ctx.arc(exPos, eyPos, Math.max(4, ws(6)), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath(); ctx.arc(exPos - 1, eyPos - 1, Math.max(2, ws(2.5)), 0, Math.PI * 2); ctx.fill();
        }
      });

      // Nucleus
      const rawChg = String(el.charge || "").trim();
      const fmtChg = (!rawChg || rawChg === "0" || /^neutral$/i.test(rawChg))
        ? ""
        : rawChg.replace(/^\+?1$/, "+").replace(/^-1$/, "-").replace(/\+/g, "⁺").replace(/-/g, "⁻").replace(/2/g, "²").replace(/3/g, "³");
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(cx, cy, nucR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = isLight ? "#ffffff" : "#071226";
      ctx.font = '800 ' + Math.max(18, Math.round(nucR * 0.82)) + 'px system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((el.symbol || el.text || "Atom") + fmtChg, cx, cy);
      // Clean shell occupancy pill under orbit rings
      ctx.fillStyle = isLight ? "#475569" : "#94a3b8";
      ctx.font = '600 ' + Math.max(13, Math.round(ws(15))) + 'px system-ui, sans-serif';
      ctx.textBaseline = "top";
      ctx.fillText("[" + shells.join(" · ") + "]", cx, cy + maxR + 6);
    } else if (el.kind === "table") {
      const rows = el.rows || [];
      const rowH = Math.max(ws(36), ph / Math.max(1, rows.length));
      drawRoundedRect(px, py, pw, rows.length * rowH, 12);
      ctx.fillStyle = isLight ? "rgba(255,255,255,0.9)" : "rgba(15,23,42,0.78)";
      ctx.fill();
      ctx.strokeStyle = col + "88";
      ctx.lineWidth = 2;
      ctx.stroke();
      const fpx = Math.max(15, Math.round(ws(19)));
      ctx.font = '600 ' + fpx + 'px system-ui, sans-serif';
      ctx.textBaseline = "middle";
      rows.forEach((row, idx) => {
        if (idx > 0) {
          ctx.strokeStyle = isLight ? "rgba(15,23,42,0.12)" : "rgba(148,163,184,0.18)";
          ctx.beginPath(); ctx.moveTo(px + 10, py + idx * rowH); ctx.lineTo(px + pw - 10, py + idx * rowH); ctx.stroke();
        }
        ctx.fillStyle = idx === 0 ? col : (isLight ? "#0f172a" : "#e2e8f0");
        ctx.textAlign = "left";
        ctx.fillText(row, px + 16, py + (idx + 0.5) * rowH, pw - 32);
      });
    }

    ctx.restore();
  }

  function renderCaptions(activePhraseText) {
    if (!DATA.settings.captions || !activePhraseText) return;
    const fpx = Math.max(20, Math.round(H * 0.025));
    const maxW = Math.min(W * 0.86, 1360);
    const lines = wrapLines(activePhraseText, maxW - 48, fpx).slice(0, 2);
    const lh = fpx * 1.32;
    const boxH = lines.length * lh + 22;
    ctx.font = '600 ' + fpx + 'px system-ui, -apple-system, sans-serif';
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const boxW = Math.min(maxW, Math.max(260, textW + 52));
    const bx = (W - boxW) / 2;
    const by = H - boxH - H * 0.032;

    ctx.save();
    drawRoundedRect(bx, by, boxW, boxH, 14);
    ctx.fillStyle = isLight ? "rgba(15, 23, 42, 0.88)" : "rgba(5, 10, 22, 0.84)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((ln, idx) => ctx.fillText(ln, W / 2, by + 11 + (idx + 0.5) * lh));
    ctx.restore();
  }

  function renderFrameAt(t) {
    const scenes = DATA.timeline.scenes;
    let sceneIndex = scenes.findIndex((s) => t >= s.start && t < s.start + s.duration);
    if (sceneIndex < 0) sceneIndex = t >= DATA.timeline.duration ? scenes.length - 1 : 0;
    const scene = scenes[sceneIndex];
    const sceneProg = t / Math.max(0.1, DATA.timeline.duration);

    renderBackground(sceneProg);
    renderHeader(scene, sceneIndex);

    // Smooth cross-dissolve entrance/exit for clean scene transitions
    const sinceStart = t - scene.start;
    const untilEnd = scene.start + scene.duration - t;
    let sceneAlpha = 1;
    if (sceneIndex > 0 && sinceStart < 0.25) sceneAlpha = clamp01(sinceStart / 0.25);
    else if (sceneIndex < scenes.length - 1 && untilEnd < 0.22) sceneAlpha = clamp01(untilEnd / 0.22);

    const LAYER_ORDER = {
      highlight: 0, illustration: 1, rect: 2, plot: 3, table: 4,
      graph: 5, sketch: 6, arrow: 7, atom: 8, circle: 9, latex: 10, equation: 11, label: 12
    };
    const orderedElements = [...scene.elements].sort(
      (a, b) => (LAYER_ORDER[a.kind] ?? 5) - (LAYER_ORDER[b.kind] ?? 5)
    );
    ctx.save();
    ctx.globalAlpha = sceneAlpha;
    for (const el of orderedElements) {
      renderElement(scene, sceneIndex, el, t);
    }
    ctx.restore();

    const activePhrase = DATA.phrases.find((p) => t >= p.start && t <= p.end + 0.15)
      || DATA.phrases.find((p) => p.sceneIndex === sceneIndex);
    renderCaptions(activePhrase ? activePhrase.text : "");
  }

  // Render every frame deterministically and pipe JPEG blobs to loopback HTTP -> ffmpeg image2pipe!
  for (let frameIdx = 0; frameIdx < DATA.totalFrames; frameIdx++) {
    const t = Math.min(DATA.timeline.duration, frameIdx / FPS);
    renderFrameAt(t);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    const res = await fetch(postUrl + "?idx=" + frameIdx, { method: "POST", body: blob });
    if (!res.ok) throw new Error("Frame pipe write failed at frame " + frameIdx);
  }
  return { renderedFrames: DATA.totalFrames };
};
if (typeof window !== "undefined" && window.location.search.includes("autostart=1")) {
  window.addEventListener("load", () => {
    window.__LAMTUBE_BOOT__("/frame")
      .then(() => fetch("/done", { method: "POST" }))
      .catch((err) => fetch("/error", { method: "POST", body: String(err && err.stack ? err.stack : err) }));
  });
}
</script>
</body>
</html>`;
}

export async function renderVideoToMp4(opts: {
  timeline: LessonTimeline;
  settings: VideoSettings;
  clips: { sceneIndex: number; phraseIndex: number; text: string; bytes: Buffer }[];
  assets?: { key: string; mimeType: string; bytes: Buffer }[];
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<RenderedMp4Result> {
  const fps = 30;
  const { width, height } = resolutionForAspect(opts.settings.aspect);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "scholar-lamtube-render-"));
  let server: http.Server | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let chromeProc: ReturnType<typeof spawn> | null = null;

  try {
    opts.onProgress?.(5);
    const { audioPath, totalDuration, phrases } = await concatAndMeasureAudio(workDir, opts.clips, opts.signal);
    const syncedTimeline = resyncTimelineToAudio(opts.timeline, phrases, totalDuration);
    const captionsVtt = buildCaptionsVtt(phrases);
    const totalFrames = Math.max(fps * 2, Math.ceil(totalDuration * fps));

    opts.onProgress?.(18);
    const katexCss = buildKatexCssWithEmbeddedFonts();
    const katexItems = preRenderKatexMarkup(syncedTimeline, opts.settings.style === "whiteboard");
    const assetDataUrls: Record<string, string> = {};
    for (const a of opts.assets ?? []) {
      assetDataUrls[a.key] = `data:${a.mimeType};base64,${a.bytes.toString("base64")}`;
    }

    const html = compositorHtml({
      timeline: syncedTimeline,
      phrases,
      settings: opts.settings,
      width,
      height,
      fps,
      totalFrames,
      katexCss,
      katexItems,
      assetDataUrls,
      paletteColors: { ...palette },
    });

    const outMp4 = path.join(workDir, "output.mp4");
    const framePipe = new PassThrough();
    const ffmpegStderr: Buffer[] = [];
    const ffmpegProc = spawn(
      ffmpegBinary(),
      [
        "-y",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-r",
        String(fps),
        "-i",
        "pipe:0",
        "-i",
        audioPath,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-shortest",
        outMp4,
      ],
      { stdio: ["pipe", "ignore", "pipe"], signal: opts.signal }
    );
    framePipe.pipe(ffmpegProc.stdin);
    ffmpegProc.stderr.on("data", (d: Buffer) => ffmpegStderr.push(d));

    const ffmpegDone = new Promise<void>((resolve, reject) => {
      ffmpegProc.on("error", reject);
      ffmpegProc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg encode exited ${code}: ${Buffer.concat(ffmpegStderr).toString("utf8").slice(-800)}`));
      });
    });

    let lastPct = 20;
    let resolveStageDone: (() => void) | null = null;
    let rejectStageDone: ((err: Error) => void) | null = null;
    const stageDonePromise = new Promise<void>((resolve, reject) => {
      resolveStageDone = resolve;
      rejectStageDone = reject;
    });

    server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || "/", "http://127.0.0.1");
      if (req.method === "GET" && reqUrl.pathname === "/stage") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      if (req.method === "POST" && reqUrl.pathname === "/done") {
        res.writeHead(200);
        res.end("ok");
        resolveStageDone?.();
        return;
      }
      if (req.method === "POST" && reqUrl.pathname === "/error") {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          res.writeHead(200);
          res.end("ok");
          rejectStageDone?.(new Error(Buffer.concat(chunks).toString("utf8") || "Stage render failed in Chromium"));
        });
        return;
      }
      if (req.method === "POST" && reqUrl.pathname === "/frame") {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const buf = Buffer.concat(chunks);
          const idx = Number(reqUrl.searchParams.get("idx") ?? 0);
          const ok = framePipe.write(buf);
          const pct = Math.min(92, 20 + Math.floor((72 * (idx + 1)) / totalFrames));
          if (pct >= lastPct + 8) {
            lastPct = pct;
            opts.onProgress?.(pct);
          }
          if (ok) {
            res.writeHead(200);
            res.end("ok");
          } else {
            framePipe.once("drain", () => {
              res.writeHead(200);
              res.end("ok");
            });
          }
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as { port: number }).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const executablePath = await resolveChromeExecutable();
    if (executablePath) {
      const chromeProfile = path.join(workDir, "chrome-profile");
      await fs.mkdir(chromeProfile, { recursive: true });
      chromeProc = spawn(
        executablePath,
        [
          "--headless=new",
          `--user-data-dir=${chromeProfile}`,
          `--window-size=${width},${height}`,
          "--no-first-run",
          "--no-default-browser-check",
          "--mute-audio",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--use-gl=angle",
          "--use-angle=swiftshader",
          `${baseUrl}/stage?autostart=1`,
        ],
        { stdio: ["ignore", "ignore", "pipe"], signal: opts.signal }
      );
      const chromeErr: Buffer[] = [];
      chromeProc.stderr?.on("data", (d: Buffer) => chromeErr.push(d));
      chromeProc.once("exit", (code) => {
        if (code && code !== 0) {
          rejectStageDone?.(new Error(`Headless Chrome exited ${code}: ${Buffer.concat(chromeErr).toString("utf8").slice(-400)}`));
        }
      });
      await stageDonePromise;
      chromeProc.kill();
      chromeProc = null;
    } else {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader"],
      });
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(`${baseUrl}/stage`, { waitUntil: "load" });
      await page.evaluate(async (postUrl) => {
        const boot = (window as unknown as { __LAMTUBE_BOOT__: (u: string) => Promise<unknown> }).__LAMTUBE_BOOT__;
        await boot(postUrl);
      }, `${baseUrl}/frame`);
      await browser.close();
      browser = null;
    }

    framePipe.end();
    await ffmpegDone;

    opts.onProgress?.(95);

    // Mandatory ffprobe & non-black midpoint verification
    const probe = await runProcess(
      ffprobeBinary(),
      ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", outMp4],
      opts.signal
    );
    const probeJson = JSON.parse(probe.stdout.toString("utf8")) as {
      format?: { duration?: string };
      streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number }[];
    };
    const vStream = probeJson.streams?.find((s) => s.codec_type === "video");
    const aStream = probeJson.streams?.find((s) => s.codec_type === "audio");
    const mp4Duration = Number(probeJson.format?.duration ?? 0);
    if (!vStream || !aStream || mp4Duration <= 0.5) {
      throw new Error("Encoded MP4 failed ffprobe stream verification (missing audio or video stream).");
    }

    // Check midpoint frame has non-black visual variance
    const samplePng = path.join(workDir, "mid.png");
    await runProcess(
      ffmpegBinary(),
      ["-y", "-ss", String(Math.max(0.5, mp4Duration * 0.4)), "-i", outMp4, "-frames:v", "1", samplePng],
      opts.signal
    );
    const stats = await sharp(samplePng).stats();
    const maxMean = Math.max(...stats.channels.slice(0, 3).map((c) => c.mean));
    const maxStd = Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev));
    if (maxMean < 3 || maxStd < 3) {
      throw new Error("Rendered MP4 failed visual QA luminance check (blank or uniform frames detected).");
    }

    const mp4Bytes = await fs.readFile(outMp4);
    const digest = createHash("sha256").update(mp4Bytes).digest("hex");
    opts.onProgress?.(100);

    return {
      mp4Bytes,
      captionsVtt,
      width: vStream.width ?? width,
      height: vStream.height ?? height,
      fps,
      duration: mp4Duration,
      sizeBytes: mp4Bytes.byteLength,
      codec: `${vStream.codec_name ?? "h264"}+${aStream.codec_name ?? "aac"}`,
      mimeType: "video/mp4",
      digest,
    };
  } finally {
    if (chromeProc) chromeProc.kill();
    if (browser) await browser.close().catch(() => {});
    if (server) server.close();
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
