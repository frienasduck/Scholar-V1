import type { LessonTimeline, Scene } from "./model";
export const clamp = (n: number, low: number, high: number) =>
  Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
export function locate(timeline: LessonTimeline, time: number) {
  const t = clamp(time, 0, Math.max(0, timeline.duration - 0.0001));
  const sceneIndex = Math.max(
    0,
    timeline.scenes.findIndex((s) => t >= s.start && t < s.start + s.duration)
  );
  const scene = timeline.scenes[sceneIndex];
  let offset = 0;
  let clipIndex = scene.clips.length - 1;
  for (let i = 0; i < scene.clips.length; i++) {
    if (t - scene.start < offset + scene.clips[i].duration) {
      clipIndex = i;
      break;
    }
    offset += scene.clips[i].duration;
  }
  return {
    scene,
    sceneIndex,
    clipIndex,
    clip: scene.clips[clipIndex],
    local: t - scene.start,
    clipStart: scene.start + offset,
    clipTime: Math.max(0, t - scene.start - offset),
  };
}
export function frame(scene: Scene, time: number, reducedMotion = false) {
  const starts: number[] = [];
  let cursor = 0;
  scene.clips.forEach((c) => {
    starts.push(cursor);
    cursor += c.duration;
  });
  const states = new Map(
    scene.elements.map((e) => [
      e.id,
      {
        opacity: scene.cues.some(
          (c) => c.element === e.id && ["reveal", "draw"].includes(c.effect)
        )
          ? 0
          : 1,
        dx: 0,
        dy: 0,
        draw: scene.cues.some((c) => c.element === e.id && c.effect === "draw")
          ? 0
          : 1,
        scale: 1,
      },
    ])
  );
  for (const cue of scene.cues) {
    const state = states.get(cue.element)!;
    const clip = scene.clips[cue.phrase];
    const start = starts[cue.phrase] + cue.offset * clip.duration;
    const raw = clamp((time - start) / (cue.duration * clip.duration), 0, 1);
    const p = reducedMotion ? (raw > 0 ? 1 : 0) : raw * raw * (3 - 2 * raw);
    if (cue.effect === "reveal") state.opacity = Math.max(state.opacity, p);
    if (cue.effect === "draw") {
      state.opacity = Math.max(state.opacity, p > 0 ? 1 : 0);
      state.draw = Math.max(state.draw, p);
    }
    if (cue.effect === "move") {
      state.dx += cue.dx * p;
      state.dy += cue.dy * p;
    }
    if (cue.effect === "pulse" && !reducedMotion && raw > 0 && raw < 1)
      state.scale = 1 + 0.06 * Math.sin(raw * Math.PI);
  }
  const progress = reducedMotion ? 0 : clamp(time / scene.duration, 0, 1);
  return {
    elements: states,
    camera: {
      x: reducedMotion ? 0 : scene.camera.x * progress,
      y: reducedMotion ? 0 : scene.camera.y * progress,
      zoom: 1 + (scene.camera.zoom - 1) * progress,
    },
  };
}
export function contextAt(timeline: LessonTimeline, time: number) {
  const at = locate(timeline, time);
  return {
    time: clamp(time, 0, timeline.duration),
    title: at.scene.title,
    chapterId: at.scene.chapterId,
    goal: at.scene.goal,
    narration: at.clip.text,
    surroundingNarration: at.scene.phrases.join(" "),
    visibleElements: at.scene.elements
      .filter(
        (e) =>
          (frame(at.scene, at.local).elements.get(e.id)?.opacity ?? 0) > 0.05
      )
      .map((e) => ({ kind: e.kind, text: e.text, rows: e.rows })),
    sourceIds: at.scene.sourceIds,
  };
}
export function clockLabel(time: number) {
  const s = Math.max(0, Math.floor(time));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
