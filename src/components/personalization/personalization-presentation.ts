export const BUILD_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260723_145606_ab143199-b593-4941-bb1b-9afca215416b.mp4";

// User-supplied SpaceEdu footage, crossfaded as a backdrop rather than a
// journey between planets. Questionnaire progress does not control the scene.
const SCENE_BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/";
export const SCHOLAR_SCENES = {
  earth: {
    label: "Earth",
    video: `${SCENE_BASE}hf_20260827_202422_3ffb4889-c520-432d-8458-038009eb40df.mp4`,
    poster: `${SCENE_BASE}hf_20260827_202133_508c64b8-a31e-4290-bdfc-1187df70e0a6.png`,
  },
  venus: {
    label: "Venus",
    video: `${SCENE_BASE}hf_20260827_202422_b211cd74-013b-4dd3-bfd0-64491d8696fa.mp4`,
    poster: `${SCENE_BASE}hf_20260827_202133_cf55d1d8-7b59-4a64-80da-d72052ae974e.png`,
  },
  mars: {
    label: "Mars",
    video: `${SCENE_BASE}hf_20260827_202422_51eae59a-2459-4c84-907c-cc5edfe5fea7.mp4`,
    poster: `${SCENE_BASE}hf_20260827_202133_0ba6de7c-285d-43dc-b7ab-8c54c73707cb.png`,
  },
} as const;
export type ScholarScene = keyof typeof SCHOLAR_SCENES;
export const SCHOLAR_SCENE_ORDER: ScholarScene[] = ["earth", "venus", "mars"];
export const nextScholarScene = (scene: ScholarScene): ScholarScene => SCHOLAR_SCENE_ORDER[(SCHOLAR_SCENE_ORDER.indexOf(scene)+1)%SCHOLAR_SCENE_ORDER.length];

export const CHAPTER_STORY = [
  { eyebrow: "01 / THE BEGINNING", title: "Made for\nyour world.", note: "A learning space that starts with you, not a template." },
  { eyebrow: "02 / YOUR AMBITION", title: "Give your goals\na direction.", note: "Every ambition deserves a place to begin." },
  { eyebrow: "03 / YOUR SUBJECTS", title: "Find your\ncentre of gravity.", note: "Let the important things move closer." },
  { eyebrow: "04 / HOW YOU LEARN", title: "Learn in your\nown language.", note: "The best explanation is the one that makes sense to you." },
  { eyebrow: "05 / YOUR LAM", title: "A guide with\nyour rhythm.", note: "Set the tone for the help that follows." },
  { eyebrow: "06 / YOUR TIME", title: "Make room\nfor progress.", note: "Small, steady sessions can change everything." },
  { eyebrow: "07 / THE FINISHING TOUCHES", title: "Bring it\nall together.", note: "Your materials and next steps, in one place." },
] as const;

export const CHAPTERS = [
  { label: "You", first: 1 }, { label: "Goals", first: 2 },
  { label: "Subjects", first: 3 }, { label: "Learning", first: 4 },
  { label: "LAM AI", first: 6 }, { label: "Routine", first: 7 },
  { label: "Final touches", first: 9 },
] as const;

export function currentChapter(stage: number) {
  return CHAPTERS.findLastIndex((chapter) => stage >= chapter.first);
}

/** Real server stages drive the cinematic copy; no simulated progress or delay. */
export const BUILD_COPY: Record<string, string> = {
  profile: "Mapping what matters most", priorities: "Organizing your subjects",
  materials: "Bringing your study world together", lam: "Tuning LAM AI",
  strategy: "Shaping your study rhythm", dashboard: "Preparing Scholar Today",
};
