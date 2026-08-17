#!/usr/bin/env node
/**
 * Scholar Android — brand icon generator.
 *
 * Renders the Scholar mark (gradient orb + spark) as PNGs with a pure-Node
 * encoder (zlib is built into Node), so no image tooling is required.
 *
 * Outputs (all written to assets/images/):
 *   icon.png                        — legacy launcher icon (1024x1024, dark graphite)
 *   android-icon-foreground.png     — adaptive foreground (transparent, mark in safe zone)
 *   android-icon-background.png     — adaptive background (solid dark graphite)
 *   android-icon-monochrome.png     — adaptive monochrome (white spark on transparent)
 *   splash-icon.png                 — splash image (transparent, orb + spark)
 *   favicon.png                     — web favicon (48x48)
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "images");

// ---------------------------------------------------------------------------
// Minimal PNG encoder
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ---------------------------------------------------------------------------
// Renderer with supersampling for smooth edges
// ---------------------------------------------------------------------------
const SS = 3; // supersampling factor

function render(size, pixelFn) {
  const rgba = Buffer.alloc(size * size * 4);
  const step = 1 / (size * SS);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const [pr, pg, pb, pa] = pixelFn(u, v);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      }
      const n = SS * SS;
      const alpha = a / n;
      const idx = (y * size + x) * 4;
      if (alpha <= 0) {
        rgba[idx] = rgba[idx + 1] = rgba[idx + 2] = rgba[idx + 3] = 0;
        continue;
      }
      rgba[idx] = clamp255(r / a);
      rgba[idx + 1] = clamp255(g / a);
      rgba[idx + 2] = clamp255(b / a);
      rgba[idx + 3] = clamp255(alpha * 255);
    }
  }
  return encodePNG(size, size, rgba);
}

// ---------------------------------------------------------------------------
// Brand mark geometry
// ---------------------------------------------------------------------------
const INDIGO = hexToRgb("#6366F1");
const VIOLET = hexToRgb("#8B5CF6");
const GRAPHITE = hexToRgb("#0B0B12");
const GRAPHITE_SOFT = hexToRgb("#15151F");
const WHITE = [255, 255, 255];

/** 4-point concave star along the axes. r(theta) = R * |cos(2t)|^p */
function sparkShape(u, v, cx, cy, radius, power) {
  const dx = u - cx;
  const dy = v - cy;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return 1;
  const theta = Math.atan2(dy, dx);
  const starR = radius * Math.pow(Math.abs(Math.cos(2 * theta)), power);
  return 1 - dist / starR; // >0 inside, <=0 outside
}

/** Soft glow around a point. */
function glow(u, v, cx, cy, radius) {
  const d = Math.hypot(u - cx, v - cy) / radius;
  return Math.exp(-d * d);
}

/**
 * The mark: gradient orb + white spark, centered at (cx, cy) in unit space.
 * Returns [r, g, b, a].
 */
function markPixel(u, v, cx, cy, scale = 1) {
  const orbR = 0.30 * scale;
  const sparkR = 0.20 * scale;
  const spark2R = 0.11 * scale;

  // Orb: indigo -> violet radial
  const d = Math.hypot(u - cx, v - cy);
  const orbAlpha = d < orbR ? 1 : Math.max(0, 1 - (d - orbR) / (0.10 * scale));
  const t = Math.min(1, d / (orbR * 1.35));
  const orbRgb = [
    INDIGO[0] + (VIOLET[0] - INDIGO[0]) * t,
    INDIGO[1] + (VIOLET[1] - INDIGO[1]) * t,
    INDIGO[2] + (VIOLET[2] - INDIGO[2]) * t,
  ];
  // Violet halo around the orb
  const halo = 0.32 * glow(u, v, cx, cy, orbR * 2.1) * (1 - orbAlpha);

  // White spark (main + rotated small)
  const s1 = sparkShape(u, v, cx, cy, sparkR, 0.5);
  const s2 = sparkShape(u, v, cx, cy, spark2R, 0.5);
  const sparkAlpha = clamp255(Math.max(0, Math.min(1, s1 * 1.15)) + Math.max(0, Math.min(1, s2 * 1.2)) * 0.85) / 255;

  let r = 0, g = 0, b = 0, a = 0;
  // orb layer
  r += orbRgb[0] * orbAlpha; g += orbRgb[1] * orbAlpha; b += orbRgb[2] * orbAlpha; a += orbAlpha;
  // halo layer (violet tint over background)
  r += VIOLET[0] * halo; g += VIOLET[1] * halo; b += VIOLET[2] * halo; a += halo;
  // spark layer
  r += WHITE[0] * sparkAlpha; g += WHITE[1] * sparkAlpha; b += WHITE[2] * sparkAlpha; a += sparkAlpha;
  return [r, g, b, a];
}

/** Dark graphite background with a soft radial lift toward the top. */
function graphitePixel(u, v) {
  const lift = 0.10 * glow(u, v, 0.5, 0.42, 0.9);
  return [
    GRAPHITE[0] + (GRAPHITE_SOFT[0] - GRAPHITE[0]) * lift,
    GRAPHITE[1] + (GRAPHITE_SOFT[1] - GRAPHITE[1]) * lift,
    GRAPHITE[2] + (GRAPHITE_SOFT[2] - GRAPHITE[2]) * lift,
    1,
  ];
}

// ---------------------------------------------------------------------------
// Icon recipes
// ---------------------------------------------------------------------------
const recipes = {
  "icon.png": (size) => {
    const cx = 0.5, cy = 0.5;
    return render(size, (u, v) => {
      const bg = graphitePixel(u, v);
      const mark = markPixel(u, v, cx, cy, 0.92);
      // composite mark over bg
      const alpha = mark[3];
      const inv = 1 - alpha;
      return [
        mark[0] + bg[0] * inv,
        mark[1] + bg[1] * inv,
        mark[2] + bg[2] * inv,
        Math.max(alpha, bg[3]),
      ];
    });
  },
  // Adaptive foreground: mark centered in the safe zone (central ~66%)
  "android-icon-foreground.png": (size) => {
    const cx = 0.5, cy = 0.5;
    return render(size, (u, v) => markPixel(u, v, cx, cy, 0.72));
  },
  "android-icon-background.png": (size) => {
    return render(size, (u, v) => graphitePixel(u, v));
  },
  "android-icon-monochrome.png": (size) => {
    const cx = 0.5, cy = 0.5;
    return render(size, (u, v) => {
      const s = Math.max(0, sparkShape(u, v, cx, cy, 0.24, 0.5));
      return [255, 255, 255, Math.min(1, s * 1.1)];
    });
  },
  "splash-icon.png": (size) => {
    const cx = 0.5, cy = 0.5;
    return render(size, (u, v) => markPixel(u, v, cx, cy, 1));
  },
  "favicon.png": (size) => {
    const cx = 0.5, cy = 0.5;
    return render(size, (u, v) => {
      const bg = graphitePixel(u, v);
      const mark = markPixel(u, v, cx, cy, 1);
      const alpha = mark[3];
      const inv = 1 - alpha;
      return [mark[0] + bg[0] * inv, mark[1] + bg[1] * inv, mark[2] + bg[2] * inv, Math.max(alpha, bg[3])];
    });
  },
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [file, recipe] of Object.entries(recipes)) {
  const size = file === "favicon.png" ? 48 : 1024;
  writeFileSync(join(OUT_DIR, file), recipe(size));
  console.log(`wrote ${file} (${size}x${size})`);
}
