import { assembleTimeline, initialVideo, scenePlanSchema } from "./model";
/** Authored, explicitly silent preview, never presented as a generated account lesson. */
export function previewVideo() {
  const v = initialVideo(
    "preview",
    {
      title: "Force makes motion change",
      grade: 11,
      subjectId: "physics",
      chapters: [{ id: "laws-of-motion", title: "Laws of Motion" }],
      topic: "Newton's second law",
      prompt: "",
      resourceIds: [],
      strictSources: false,
      minutes: 1,
      style: "motion-graphics",
      voice: "autumn",
      depth: "beginner",
      purpose: "learn",
      pace: "normal",
      aspect: "16:9",
      captions: true,
      interactive: true,
    },
    0
  );
  const plan = scenePlanSchema.parse({
    title: "Watch force become acceleration",
    chapterId: "laws-of-motion",
    goal: "Connect force, mass and acceleration visually.",
    phrases: [
      "A net force changes the velocity of an object. Watch this block: the arrow shows the applied net force.",
      "Newton's second law connects net force, mass and acceleration: F equals m a.",
      "Keep mass fixed. A larger net force produces a larger acceleration, in the same direction as the net force.",
      "For a mass of two kilograms and net force of six newtons, acceleration is three metres per second squared.",
    ],
    elements: [
      {
        id: "ground",
        kind: "sketch",
        x: 100,
        y: 490,
        w: 800,
        h: 1,
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        color: "muted",
      },
      {
        id: "block",
        kind: "rect",
        x: 190,
        y: 320,
        w: 160,
        h: 160,
        text: "2 kg",
        color: "blue",
      },
      {
        id: "force",
        kind: "arrow",
        x: 370,
        y: 385,
        w: 220,
        h: 0,
        text: "F = 6 N",
        color: "cyan",
      },
      {
        id: "law",
        kind: "equation",
        x: 310,
        y: 170,
        w: 600,
        text: "F = m a",
        color: "white",
      },
      {
        id: "accel",
        kind: "label",
        x: 180,
        y: 630,
        w: 650,
        text: "Acceleration follows the net force",
        color: "cyan",
      },
      {
        id: "working",
        kind: "equation",
        x: 250,
        y: 735,
        w: 700,
        text: "a = 6 / 2 = 3 m/s²",
        color: "green",
      },
    ],
    cues: [
      { element: "ground", phrase: 0, effect: "draw", duration: 0.3 },
      { element: "block", phrase: 0, effect: "reveal", duration: 0.3 },
      { element: "force", phrase: 0, effect: "draw", offset: 0.3 },
      { element: "law", phrase: 1, effect: "reveal" },
      { element: "block", phrase: 2, effect: "move", dx: 330, duration: 0.85 },
      { element: "force", phrase: 2, effect: "move", dx: 260, duration: 0.85 },
      { element: "accel", phrase: 2, effect: "reveal" },
      { element: "working", phrase: 3, effect: "reveal" },
    ],
    camera: { x: -15, y: 0, zoom: 1.04 },
    sourceIds: [],
    question: {
      prompt:
        "A net force of 12 N acts on a 2 kg mass. What is its acceleration?",
      options: ["3 m/s²", "6 m/s²", "12 m/s²", "24 m/s²"],
      answer: 1,
      explanation: "a = F/m = 12/2 = 6 m/s², along the net force.",
    },
  });
  const second = scenePlanSchema.parse({
    title: "Read the relationship",
    chapterId: plan.chapterId,
    goal: "At fixed mass, acceleration is proportional to net force.",
    phrases: [
      "Plot net force horizontally and acceleration vertically, with mass held fixed.",
      "The straight line through the origin shows direct proportionality. Doubling force doubles acceleration.",
      "The slope is one divided by mass. A larger mass has a shallower acceleration-versus-force graph.",
    ],
    elements: [
      {
        id: "axes",
        kind: "sketch",
        x: 180,
        y: 260,
        w: 640,
        h: 460,
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 1000 },
          { x: 1000, y: 1000 },
        ],
        color: "muted",
      },
      {
        id: "line",
        kind: "graph",
        x: 180,
        y: 260,
        w: 640,
        h: 460,
        points: [
          { x: 0, y: 1000 },
          { x: 1000, y: 0 },
        ],
        color: "cyan",
      },
      {
        id: "y",
        kind: "label",
        x: 95,
        y: 195,
        text: "Acceleration a",
        color: "cyan",
      },
      {
        id: "x",
        kind: "label",
        x: 540,
        y: 815,
        text: "Net force F",
        color: "blue",
      },
      {
        id: "slope",
        kind: "equation",
        x: 420,
        y: 380,
        text: "slope = 1/m",
        color: "white",
      },
      {
        id: "heavy",
        kind: "graph",
        x: 180,
        y: 260,
        w: 640,
        h: 460,
        points: [
          { x: 0, y: 1000 },
          { x: 1000, y: 500 },
        ],
        color: "violet",
      },
    ],
    cues: [
      { element: "axes", phrase: 0, effect: "draw" },
      { element: "line", phrase: 1, effect: "draw" },
      { element: "slope", phrase: 2, effect: "reveal" },
      { element: "heavy", phrase: 2, effect: "draw", offset: 0.2 },
    ],
    sourceIds: [],
    camera: { x: 0, y: 0, zoom: 1 },
  });
  const plans = [plan, second];
  const clips = plans.map((p, i) =>
    p.phrases.map((text, n) => ({ id: `preview-${i}-${n}`, text, duration: 7 }))
  );
  const outline = {
    title: v.title,
    summary:
      "An authored demonstration of force, acceleration and their relationship.",
    scenes: plans.map((p) => ({
      title: p.title,
      chapterId: p.chapterId,
      goal: p.goal,
    })),
  };
  return {
    ...v,
    outline,
    plans,
    clips,
    status: "ready" as const,
    stage: "complete" as const,
    timeline: assembleTimeline(plans, clips),
  };
}
