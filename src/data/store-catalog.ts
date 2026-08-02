export type StoreCategory = "themes" | "canvas" | "revision" | "flashcards" | "avatars" | "lam";

export type StoreProduct = {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  price: number;
  category: StoreCategory;
  accent: string;
  tags: string[];
  downloadable?: boolean;
  themeId?: string;
  contents: string[];
  requiresPlus?: boolean;
};

const product = (value: StoreProduct) => value;

export const STORE_PRODUCTS: StoreProduct[] = [
  product({ id: "theme-aurora", name: "Aurora", description: "Emerald and violet northern-sky palette.", longDescription: "A high-contrast dark theme with calm emerald actions, violet accents, and an aurora canvas token.", price: 300, category: "themes", accent: "#34d399", tags: ["dark", "green", "violet"], themeId: "theme-aurora", contents: ["Global colour tokens", "Sidebar and focus rings", "Canvas background token"] }),
  product({ id: "theme-sunset", name: "Sunset", description: "Warm amber and rose evening palette.", longDescription: "Designed for evening revision with warm amber controls, rose accents, and retained WCAG-focused contrast.", price: 300, category: "themes", accent: "#fbbf24", tags: ["dark", "warm", "rose"], themeId: "theme-sunset", contents: ["Global colour tokens", "Warm study surfaces", "Matching canvas token"] }),
  product({ id: "theme-glass", name: "Glassmorphism Pro", description: "Cool cyan glass with stronger depth.", longDescription: "A restrained glass theme for primary surfaces with cyan focus states and cool blue depth.", price: 500, category: "themes", accent: "#67e8f9", tags: ["dark", "cyan", "glass"], themeId: "theme-glass", contents: ["Global colour tokens", "Glass card palette", "Cyan focus system"], requiresPlus: true }),
  product({ id: "theme-paper", name: "Focus Paper", description: "Warm paper and ink-blue light theme.", longDescription: "A low-distraction light theme with warm paper surfaces, ink-blue actions, and clear contrast.", price: 350, category: "themes", accent: "#315a88", tags: ["light", "paper", "focus"], themeId: "theme-paper", contents: ["Light application palette", "Ink-blue controls", "Warm canvas token"] }),

  product({ id: "canvas-grid-pro", name: "Engineering Grid", description: "Precision graph workspace for numericals.", longDescription: "A downloadable SVG graph background with major and minor grid lines for Physics and Mathematics.", price: 120, category: "canvas", accent: "#38bdf8", tags: ["physics", "maths", "graph"], downloadable: true, contents: ["Scalable SVG background", "5 mm minor grid", "25 mm major grid"] }),
  product({ id: "canvas-cornell", name: "Cornell Notes Kit", description: "Cue, notes, and summary workspace.", longDescription: "A structured study template that separates recall cues, main notes, and the final summary.", price: 140, category: "canvas", accent: "#fbbf24", tags: ["notes", "template"], downloadable: true, contents: ["Cornell layout SVG", "Usage guide", "Recall prompts"] }),
  product({ id: "canvas-lab", name: "Lab Observation Board", description: "Aim, method, readings, and inference.", longDescription: "A printable and Canvas-ready layout for recording practical observations safely and consistently.", price: 160, category: "canvas", accent: "#34d399", tags: ["lab", "physics", "chemistry"], downloadable: true, contents: ["Observation table", "Safety checklist", "Inference area"], requiresPlus: true }),
  product({ id: "canvas-code", name: "Python Trace Board", description: "Trace variables and program output.", longDescription: "A study board for dry-running Python code with columns for step, variables, condition, and output.", price: 130, category: "canvas", accent: "#a78bfa", tags: ["python", "cs", "trace"], downloadable: true, contents: ["Trace table", "Test-case panel", "Complexity notes"] }),

  product({ id: "revision-physics", name: "Physics Formula Sprint", description: "Class 11 mechanics recall pack.", longDescription: "An original Scholar revision pack covering units, vectors, kinematics, laws of motion, work-energy, and gravitation.", price: 220, category: "revision", accent: "#60a5fa", tags: ["class 11", "physics", "formula"], downloadable: true, contents: ["6 topic checklists", "Formula recall sheet", "12 exam prompts"] }),
  product({ id: "revision-chemistry", name: "Chemistry Concept Sprint", description: "Mole, bonding, and periodicity review.", longDescription: "A concise Class 11 chemistry revision pack with original checklists, misconception warnings, and practice prompts.", price: 220, category: "revision", accent: "#34d399", tags: ["class 11", "chemistry"], downloadable: true, contents: ["Concept checklists", "Common mistakes", "Practice prompts"] }),
  product({ id: "revision-maths", name: "Mathematics Identity Sprint", description: "Algebra and trigonometry recall pack.", longDescription: "A printable recall routine for sets, relations, trigonometric identities, complex numbers, and sequences.", price: 220, category: "revision", accent: "#a78bfa", tags: ["maths", "identities"], downloadable: true, contents: ["Identity sheet", "Mixed drill", "Self-check rubric"] }),
  product({ id: "revision-class9", name: "Class 9 Science Sprint", description: "Matter, motion, cells, and forces.", longDescription: "A cross-topic Class 9 Science revision pack built from Scholar's curriculum data.", price: 180, category: "revision", accent: "#2dd4bf", tags: ["class 9", "science"], downloadable: true, contents: ["4 topic checklists", "Key definitions", "Mini self-test"], requiresPlus: true }),

  product({ id: "cards-physics", name: "Physics Rapid Cards", description: "40 mechanics recall prompts.", longDescription: "Question-and-answer cards for definitions, formula selection, units, dimensions, and conceptual pitfalls.", price: 170, category: "flashcards", accent: "#60a5fa", tags: ["physics", "flashcards"], downloadable: true, contents: ["40 CSV-ready cards", "Import instructions", "Difficulty tags"] }),
  product({ id: "cards-chemistry", name: "Chemistry Rapid Cards", description: "40 structure and bonding prompts.", longDescription: "Recall cards covering atoms, periodicity, bonding, thermodynamics, and equilibrium foundations.", price: 170, category: "flashcards", accent: "#34d399", tags: ["chemistry", "flashcards"], downloadable: true, contents: ["40 CSV-ready cards", "Topic tags", "Review guide"] }),
  product({ id: "cards-python", name: "Python Rapid Cards", description: "Syntax, flow, collections, and debugging.", longDescription: "Practical Class 11 Computer Science cards with small code-reading prompts and precise answers.", price: 170, category: "flashcards", accent: "#fbbf24", tags: ["python", "cs"], downloadable: true, contents: ["40 CSV-ready cards", "Code prompts", "Debugging checks"] }),
  product({ id: "cards-class9-maths", name: "Class 9 Maths Cards", description: "Number systems through geometry.", longDescription: "A balanced Class 9 Mathematics recall deck for definitions, theorems, procedures, and common mistakes.", price: 150, category: "flashcards", accent: "#f472b6", tags: ["class 9", "maths"], downloadable: true, contents: ["36 CSV-ready cards", "Chapter tags", "Review schedule"] }),

  product({ id: "avatar-orbit", name: "Orbit Scholar", description: "A calm planetary profile emblem.", longDescription: "An original scalable profile emblem suitable for either Scholar profile.", price: 90, category: "avatars", accent: "#818cf8", tags: ["avatar", "space"], downloadable: true, contents: ["SVG emblem", "Dark and light safe", "Profile license"] }),
  product({ id: "avatar-circuit", name: "Circuit Scholar", description: "A precise circuit-inspired emblem.", longDescription: "An original technology profile mark for coding and engineering-focused learners.", price: 90, category: "avatars", accent: "#22d3ee", tags: ["avatar", "technology"], downloadable: true, contents: ["SVG emblem", "High contrast", "Profile license"] }),
  product({ id: "avatar-leaf", name: "Leaf Scholar", description: "A clean science-inspired emblem.", longDescription: "An original nature and science profile mark with a simple, accessible silhouette.", price: 90, category: "avatars", accent: "#4ade80", tags: ["avatar", "science"], downloadable: true, contents: ["SVG emblem", "High contrast", "Profile license"] }),
  product({ id: "avatar-sigma", name: "Sigma Scholar", description: "A mathematical monogram emblem.", longDescription: "A bold original mathematics profile mark designed for clear display at small sizes.", price: 90, category: "avatars", accent: "#fbbf24", tags: ["avatar", "maths"], downloadable: true, contents: ["SVG emblem", "Small-size optimized", "Profile license"] }),

  product({ id: "lam-skin-orbit", name: "LAM Orbit Skin", description: "Cyan-violet orb treatment.", longDescription: "A visual skin reference for LAM that preserves labels, focus rings, and message contrast.", price: 110, category: "lam", accent: "#67e8f9", tags: ["lam", "skin", "cyan"], downloadable: true, contents: ["Skin token JSON", "Contrast guidance", "Preview swatches"], requiresPlus: true }),
  product({ id: "lam-skin-ember", name: "LAM Ember Skin", description: "Warm amber assistant treatment.", longDescription: "A warm visual skin reference for LAM designed for the Sunset theme while retaining readability.", price: 110, category: "lam", accent: "#f59e0b", tags: ["lam", "skin", "warm"], downloadable: true, contents: ["Skin token JSON", "Contrast guidance", "Preview swatches"] }),
  product({ id: "lam-skin-mono", name: "LAM Mono Skin", description: "Quiet monochrome study treatment.", longDescription: "A distraction-minimized LAM skin reference with visible focus and status indicators.", price: 100, category: "lam", accent: "#cbd5e1", tags: ["lam", "skin", "focus"], downloadable: true, contents: ["Skin token JSON", "Focus tokens", "Preview swatches"] }),
  product({ id: "lam-prompts", name: "LAM Prompt Deck", description: "30 high-quality study conversation starters.", longDescription: "Original prompts for explanations, quizzes, revision, OCR cleanup, worked examples, and reflection.", price: 140, category: "lam", accent: "#c084fc", tags: ["lam", "prompts", "study"], downloadable: true, contents: ["30 prompt starters", "Six study modes", "Safety reminders"] }),
];

export const STORE_CATEGORIES: Array<{ id: StoreCategory; label: string }> = [
  { id: "themes", label: "Themes" }, { id: "canvas", label: "Canvas" }, { id: "revision", label: "Revision Packs" },
  { id: "flashcards", label: "Flashcards" }, { id: "avatars", label: "Avatars" }, { id: "lam", label: "LAM Skins" },
];
