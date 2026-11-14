import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

// Force isolated local dev pipeline mode (no Postgres mutation)
(process.env as Record<string, string | undefined>).NODE_ENV = "development";
process.env.SCHOLAR_DEV_GUEST_AI = "1";
process.env.SCHOLAR_DEV_GUEST_AI_LOCAL_SERVER = "1";
delete process.env.DB_DATABASE_URL;

import { getCurriculum } from "@/lib/curriculum-helper";
import { settingsSchema } from "@/lib/lamtube/model";
import { insertVideo, readRender, readVideo } from "@/lib/lamtube/store";
import { queueVideo } from "@/lib/lamtube/jobs";
import { processVideo } from "@/lib/lamtube/generate";

const OUT_DIR = path.join(process.cwd(), "artifacts", "ai-video-maker", "test-renders");
const FRAMES_DIR = path.join(process.cwd(), "artifacts", "ai-video-maker", "screenshots", "video-inspection");

type TopicSpec = {
  slug: string;
  subjectId: string;
  title: string;
  topic: string;
  prompt: string;
  style: "motion-graphics" | "whiteboard" | "diagram";
  minutes: 1;
};

const SPECS: TopicSpec[] = [
  {
    slug: "projectile-motion",
    subjectId: "physics",
    title: "Projectile Motion & Parabolic Trajectory",
    topic: "Projectile Motion in two dimensions: horizontal and vertical velocity components, launch angle theta, time of flight, maximum height, and range equation.",
    prompt: "Show a launched ball following a mathematical parabolic trajectory plot (y vs x), horizontal velocity vector arrow v_x remaining constant, vertical velocity vector v_y shrinking to 0 at peak and reversing, and KaTeX range/height equations.",
    style: "motion-graphics",
    minutes: 1,
  },
  {
    slug: "quadratic-functions",
    subjectId: "maths",
    title: "Understanding Quadratic Functions & Parabolas",
    topic: "Quadratic functions f(x) = ax^2 + bx + c: parabola shape, vertex, axis of symmetry, discriminant, and roots on the coordinate plane.",
    prompt: "Plot crisp coordinate curves for y = x^2 - 4x + 3 showing x-intercepts at (1,0) and (3,0), vertex at (2,-1), tangent/moving point along the parabola, and KaTeX quadratic formula.",
    style: "whiteboard",
    minutes: 1,
  },
  {
    slug: "ionic-bonding",
    subjectId: "chemistry",
    title: "Ionic Bonding: Electron Transfer in NaCl",
    topic: "Ionic bond formation between Sodium (Na) and Chlorine (Cl): valence electron transfer, octet completion, electrostatic attraction between Na+ and Cl-, and crystal lattice.",
    prompt: "Animate Sodium atom (protons 11, shells [2,8,1]) transferring one outer electron to Chlorine atom (protons 17, shells [2,8,7]) forming Na+ [2,8] and Cl- [2,8,8] ions with KaTeX equation.",
    style: "diagram",
    minutes: 1,
  },
];

function extractFrame(mp4: string, timestampSec: number, outPng: string) {
  const res = spawnSync(
    process.env.FFMPEG_PATH?.trim() || "ffmpeg",
    ["-y", "-ss", timestampSec.toFixed(2), "-i", mp4, "-frames:v", "1", outPng],
    { encoding: "utf8" }
  );
  if (res.status !== 0) {
    throw new Error(`ffmpeg frame extract failed for ${outPng}: ${res.stderr}`);
  }
}

function probeMp4(mp4: string) {
  const res = spawnSync(
    process.env.FFPROBE_PATH?.trim() || "ffprobe",
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", mp4],
    { encoding: "utf8" }
  );
  if (res.status !== 0) throw new Error(`ffprobe failed for ${mp4}`);
  return JSON.parse(res.stdout);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(FRAMES_DIR, { recursive: true });
  const curriculum = getCurriculum(11);
  const userId = "qa-video-runner";
  const summary: unknown[] = [];

  for (const spec of SPECS) {
    const subj = curriculum.find((s) => s.id === spec.subjectId) ?? curriculum[0];
    const chap = subj.chapters[0];
    const settings = settingsSchema.parse({
      title: spec.title,
      grade: 11,
      academicLevel: "class-11",
      language: "en",
      subjectId: subj.id,
      chapters: [{ id: chap.id, title: chap.title }],
      topic: spec.topic,
      prompt: spec.prompt,
      minutes: spec.minutes,
      style: spec.style,
      voice: "autumn",
      depth: "balanced",
      purpose: "learn",
      pace: "normal",
      aspect: "16:9",
      captions: true,
      interactive: true,
    });

    console.log(`\n=== Generating real test video: ${spec.slug} ===`);
    const created = await insertVideo(userId, settings, randomUUID());
    let video = await queueVideo(userId, created.id);
    for (let step = 0; step < 140 && video.status === "generating"; step++) {
      try {
        video = await processVideo(
          userId,
          video.id,
          video.stage === "render" ? 420000 : ["outline", "scenes"].includes(video.stage) ? 95000 : 60000
        );
        console.log(`  [${spec.slug}] step=${step + 1} stage=${video.stage} status=${video.status} plans=${video.plans.length} clips=${video.clips.flat().length}`);
      } catch (err) {
        const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
        const latest = await readVideo(userId, video.id);
        if (status === 429 && latest.status === "generating") {
          const waitMs = Math.max(8000, Math.min(68000, (latest.retryAt ?? Date.now() + 45000) - Date.now() + 1000));
          console.log(`  [${spec.slug}] rate-limit cooldown at step=${step + 1} (${latest.clips.flat().length} clips saved); waiting ${Math.round(waitMs / 1000)}s...`);
          await new Promise((r) => setTimeout(r, waitMs));
          video = latest;
          continue;
        }
        throw err;
      }
    }
    if (video.status !== "ready") {
      throw new Error(`Video ${spec.slug} failed at stage=${video.stage}: ${video.error}`);
    }
    const render = await readRender(userId, video.id);
    if (!render) throw new Error(`No compiled MP4 stored for ${spec.slug}`);

    const mp4Path = path.join(OUT_DIR, `${spec.slug}.mp4`);
    const vttPath = path.join(OUT_DIR, `${spec.slug}.vtt`);
    await fs.writeFile(mp4Path, render.bytes);
    await fs.writeFile(vttPath, render.captionsVtt, "utf8");

    const probe = probeMp4(mp4Path);
    const duration = Number(probe.format?.duration ?? render.meta.duration);

    const frameDir = path.join(FRAMES_DIR, spec.slug);
    await fs.mkdir(frameDir, { recursive: true });
    const sampleTimes = [
      { name: "01-opening.png", t: 0.5 },
      { name: "02-early-concept.png", t: Math.min(duration - 0.5, duration * 0.22) },
      { name: "03-mid-explanation.png", t: Math.min(duration - 0.5, duration * 0.48) },
      { name: "04-worked-motion.png", t: Math.min(duration - 0.5, duration * 0.72) },
      { name: "05-ending.png", t: Math.max(0.5, duration - 1.2) },
    ];
    for (const s of sampleTimes) {
      extractFrame(mp4Path, s.t, path.join(frameDir, s.name));
    }

    summary.push({
      slug: spec.slug,
      videoId: video.id,
      mp4Path,
      duration,
      width: render.meta.width,
      height: render.meta.height,
      fps: render.meta.fps,
      sizeBytes: render.meta.sizeBytes,
      codec: render.meta.codec,
      scenes: video.timeline?.scenes.length ?? 0,
      clips: video.clips.flat().length,
      assets: video.assets?.length ?? 0,
      streams: probe.streams?.map((s: { codec_type?: string; codec_name?: string; width?: number; height?: number }) => ({
        type: s.codec_type,
        codec: s.codec_name,
        width: s.width,
        height: s.height,
      })),
    });
  }

  await fs.writeFile(path.join(OUT_DIR, "qa-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log("\n=== ALL 3 TEST VIDEOS GENERATED SUCCESSFULLY ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("Test video generation failed:", err);
  process.exit(1);
});
