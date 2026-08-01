export const CANVAS_SCHEMA_VERSION = 2;
export const CANVAS_STORAGE_KEY = "cv-board";

export type CanvasPoint = { x: number; y: number };
export type CanvasViewport = { x: number; y: number; zoom: number };
export type CanvasObjectType =
  | "text"
  | "drawing"
  | "shape"
  | "line"
  | "sticky"
  | "formula"
  | "image"
  | "table"
  | "frame"
  | "source"
  | "checklist"
  | "flashcard"
  | "question";

export type CanvasObject = {
  id: string;
  type: CanvasObjectType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  opacity: number;
  color: string;
  fill?: string;
  strokeWidth?: number;
  text?: string;
  points?: CanvasPoint[];
  shape?: "rectangle" | "rounded" | "ellipse" | "triangle" | "diamond" | "hexagon";
  lineStyle?: "solid" | "dashed" | "curved" | "elbow";
  arrowStart?: boolean;
  arrowEnd?: boolean;
  fromId?: string;
  toId?: string;
  imageUrl?: string;
  sourceLabel?: string;
  sourceView?: string;
  sourceId?: string;
  groupId?: string;
  handwritten?: boolean;
  collapsed?: boolean;
  pinned?: boolean;
};

export type CanvasPage = {
  id: string;
  title: string;
  objects: CanvasObject[];
  viewport: CanvasViewport;
  background: "dark" | "blackboard" | "whiteboard" | "paper" | "graph";
};

export type CanvasProject = {
  id: string;
  title: string;
  subject: string;
  pages: CanvasPage[];
  activePageId: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
};

type LegacyStroke = {
  id?: string;
  tool?: string;
  color?: string;
  opacity?: number;
  width?: number;
  points?: CanvasPoint[];
  shape?: string;
  text?: string;
  layerId?: string;
};

type LegacyBoard = {
  strokes?: LegacyStroke[];
  type?: string;
  name?: string;
  pan?: CanvasPoint;
  zoom?: number;
};

export const canvasId = (prefix = "canvas") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function createCanvasObject(
  type: CanvasObjectType,
  at: CanvasPoint,
  overrides: Partial<CanvasObject> = {},
): CanvasObject {
  const size: Record<CanvasObjectType, { width: number; height: number }> = {
    text: { width: 280, height: 84 },
    drawing: { width: 200, height: 120 },
    shape: { width: 200, height: 120 },
    line: { width: 220, height: 80 },
    sticky: { width: 240, height: 180 },
    formula: { width: 360, height: 120 },
    image: { width: 320, height: 220 },
    table: { width: 420, height: 220 },
    frame: { width: 620, height: 400 },
    source: { width: 330, height: 180 },
    checklist: { width: 300, height: 220 },
    flashcard: { width: 320, height: 200 },
    question: { width: 360, height: 210 },
  };
  const defaults: Partial<Record<CanvasObjectType, Partial<CanvasObject>>> = {
    text: { text: "Double-click to edit", name: "Text", color: "#f4f4f5" },
    shape: {
      name: "Shape",
      shape: "rounded",
      color: "#2dd4bf",
      fill: "rgba(45,212,191,.08)",
      strokeWidth: 2,
    },
    line: {
      name: "Arrow",
      color: "#e4e4e7",
      strokeWidth: 2,
      arrowEnd: true,
      lineStyle: "solid",
    },
    sticky: {
      name: "Sticky note",
      text: "Add a study note…",
      color: "#f8fafc",
      fill: "#5b3f78",
      handwritten: true,
    },
    formula: {
      name: "Formula",
      text: String.raw`E_n=-\frac{13.6Z^2}{n^2}\,\mathrm{eV}`,
      color: "#f8fafc",
      fill: "rgba(20,20,28,.88)",
    },
    table: {
      name: "Table",
      text: "Concept | Meaning | Example\nTerm 1 | Definition | Application\nTerm 2 | Definition | Application",
      color: "#e4e4e7",
      fill: "rgba(15,23,42,.9)",
    },
    frame: {
      name: "Frame",
      text: "Topic frame",
      color: "#2dd4bf",
      fill: "rgba(20,184,166,.025)",
    },
    source: {
      name: "Scholar source",
      text: "Paste or describe the Scholar content you want to keep here.",
      color: "#e4e4e7",
      fill: "rgba(17,24,39,.94)",
      sourceLabel: "Scholar source",
    },
    checklist: {
      name: "Checklist",
      text: "Review definitions\nPractise examples\nCheck mistakes",
      color: "#f8fafc",
      fill: "rgba(24,24,27,.92)",
    },
    flashcard: {
      name: "Flashcard",
      text: "Front: Key concept\nBack: Explanation",
      color: "#f8fafc",
      fill: "rgba(30,41,59,.94)",
    },
    question: {
      name: "Question",
      text: "Question\n\nWrite the method and final answer here.",
      color: "#f8fafc",
      fill: "rgba(24,24,27,.94)",
    },
  };
  return {
    id: canvasId(type),
    type,
    name: type[0].toUpperCase() + type.slice(1),
    x: at.x,
    y: at.y,
    width: size[type].width,
    height: size[type].height,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    opacity: 1,
    color: "#f4f4f5",
    ...defaults[type],
    ...overrides,
  };
}

export function createBlankPage(title = "Untitled page"): CanvasPage {
  return {
    id: canvasId("page"),
    title,
    objects: [],
    viewport: { x: 100, y: 80, zoom: 1 },
    background: "dark",
  };
}

export function createBlankCanvasProject(): CanvasProject {
  const page = createBlankPage("Ideas");
  const now = new Date().toISOString();
  return {
    id: canvasId("project"),
    title: "Untitled Canvas",
    subject: "General",
    pages: [page],
    activePageId: page.id,
    createdAt: now,
    updatedAt: now,
    schemaVersion: CANVAS_SCHEMA_VERSION,
  };
}

function normalizeObject(value: Partial<CanvasObject>, index: number): CanvasObject | null {
  if (!value || typeof value !== "object" || typeof value.type !== "string") return null;
  const allowed: CanvasObjectType[] = [
    "text", "drawing", "shape", "line", "sticky", "formula", "image",
    "table", "frame", "source", "checklist", "flashcard", "question",
  ];
  if (!allowed.includes(value.type as CanvasObjectType)) return null;
  return {
    ...createCanvasObject(value.type as CanvasObjectType, {
      x: Number(value.x) || 0,
      y: Number(value.y) || 0,
    }),
    ...value,
    id: typeof value.id === "string" ? value.id : canvasId("object"),
    width: Math.max(24, Number(value.width) || 180),
    height: Math.max(24, Number(value.height) || 100),
    rotation: Number(value.rotation) || 0,
    zIndex: Number.isFinite(value.zIndex) ? Number(value.zIndex) : index + 1,
    locked: Boolean(value.locked),
    visible: value.visible !== false,
    opacity: Math.max(0.05, Math.min(1, Number(value.opacity) || 1)),
    points: Array.isArray(value.points)
      ? value.points
          .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
          .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
      : undefined,
  };
}

function migrateLegacyBoard(raw: LegacyBoard): CanvasProject {
  const project = createBlankCanvasProject();
  project.title = typeof raw.name === "string" && raw.name ? raw.name : project.title;
  const page = project.pages[0];
  page.background =
    raw.type === "whiteboard" || raw.type === "paper" || raw.type === "graph"
      ? raw.type
      : raw.type === "blackboard"
        ? "blackboard"
        : "dark";
  page.viewport = {
    x: Number(raw.pan?.x) || 100,
    y: Number(raw.pan?.y) || 80,
    zoom: Math.max(0.1, Math.min(4, (Number(raw.zoom) || 100) / 100)),
  };
  page.objects = (raw.strokes ?? []).map((stroke, index) => {
    const points = Array.isArray(stroke.points) ? stroke.points : [];
    const first = points[0] ?? { x: 80 + index * 12, y: 80 + index * 12 };
    const last = points[points.length - 1] ?? first;
    const minX = Math.min(...points.map((point) => point.x), first.x);
    const minY = Math.min(...points.map((point) => point.y), first.y);
    const maxX = Math.max(...points.map((point) => point.x), last.x);
    const maxY = Math.max(...points.map((point) => point.y), last.y);
    const relative = points.map((point) => ({ x: point.x - minX, y: point.y - minY }));
    const tool = stroke.tool ?? "pen";
    const type: CanvasObjectType =
      tool === "text" ? "text"
        : tool === "formula" ? "formula"
          : tool === "sticky" ? "sticky"
            : tool === "image" ? "image"
              : ["rect", "circle", "triangle"].includes(tool) ? "shape"
                : ["line", "arrow", "connector"].includes(tool) ? "line"
                  : "drawing";
    return createCanvasObject(type, { x: minX, y: minY }, {
      id: stroke.id || canvasId(type),
      name: type === "drawing" ? "Legacy drawing" : type[0].toUpperCase() + type.slice(1),
      width: Math.max(32, maxX - minX || (type === "text" ? 260 : 180)),
      height: Math.max(24, maxY - minY || (type === "text" ? 70 : 120)),
      color: stroke.color || "#f4f4f5",
      opacity: Number(stroke.opacity) || 1,
      strokeWidth: Number(stroke.width) || 3,
      text: stroke.text,
      imageUrl: type === "image" ? stroke.text : undefined,
      points: relative,
      shape:
        tool === "circle" ? "ellipse"
          : tool === "triangle" ? "triangle"
            : tool === "rect" ? "rectangle"
              : undefined,
      arrowEnd: tool === "arrow" || tool === "connector",
      zIndex: index + 1,
    });
  });
  return project;
}

export function normalizeCanvasProject(raw: unknown): CanvasProject {
  if (!raw || typeof raw !== "object") return createBlankCanvasProject();
  const candidate = raw as Partial<CanvasProject> & LegacyBoard;
  if (candidate.schemaVersion !== CANVAS_SCHEMA_VERSION || !Array.isArray(candidate.pages)) {
    return migrateLegacyBoard(candidate);
  }
  const fallback = createBlankCanvasProject();
  const pages = candidate.pages
    .filter((page): page is CanvasPage => Boolean(page && typeof page === "object"))
    .map((page, pageIndex) => ({
      id: typeof page.id === "string" ? page.id : canvasId("page"),
      title: typeof page.title === "string" && page.title ? page.title : `Page ${pageIndex + 1}`,
      objects: Array.isArray(page.objects)
        ? page.objects
            .map((object, index) => normalizeObject(object, index))
            .filter((object): object is CanvasObject => Boolean(object))
        : [],
      viewport: {
        x: Number(page.viewport?.x) || 0,
        y: Number(page.viewport?.y) || 0,
        zoom: Math.max(0.1, Math.min(4, Number(page.viewport?.zoom) || 1)),
      },
      background: ["dark", "blackboard", "whiteboard", "paper", "graph"].includes(page.background)
        ? page.background
        : "dark",
    }));
  if (!pages.length) pages.push(fallback.pages[0]);
  const activePageId = pages.some((page) => page.id === candidate.activePageId)
    ? String(candidate.activePageId)
    : pages[0].id;
  return {
    id: typeof candidate.id === "string" ? candidate.id : fallback.id,
    title: typeof candidate.title === "string" && candidate.title ? candidate.title : fallback.title,
    subject: typeof candidate.subject === "string" && candidate.subject ? candidate.subject : "General",
    pages,
    activePageId,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : fallback.createdAt,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : fallback.updatedAt,
    schemaVersion: CANVAS_SCHEMA_VERSION,
  };
}

export function cloneCanvasProject(project: CanvasProject): CanvasProject {
  return JSON.parse(JSON.stringify(project)) as CanvasProject;
}

export function chemistryReactionTemplate(): CanvasObject[] {
  const objects: CanvasObject[] = [
    createCanvasObject("text", { x: 260, y: 60 }, {
      name: "Title",
      text: "Nucleophilic Substitution\n(SN2 Mechanism)",
      width: 620,
      height: 130,
      color: "#f8fafc",
      handwritten: true,
      zIndex: 2,
    }),
    createCanvasObject("formula", { x: 170, y: 235 }, {
      name: "Reaction mechanism",
      text: String.raw`\underset{\text{nucleophile}}{\mathrm{:Nu^-}}+\mathrm{R{-}LG}\longrightarrow[\mathrm{Nu\cdots R\cdots LG}]^{\ddagger}\longrightarrow\mathrm{Nu{-}R}+\mathrm{LG^-}`,
      width: 900,
      height: 150,
      color: "#e4e4e7",
      zIndex: 3,
    }),
    createCanvasObject("text", { x: 180, y: 380 }, {
      name: "Backside attack",
      text: "Backside\nattack",
      width: 180,
      height: 90,
      color: "#38bdf8",
      handwritten: true,
      zIndex: 4,
    }),
    createCanvasObject("text", { x: 660, y: 390 }, {
      name: "Transition state",
      text: "Transition\nState",
      width: 210,
      height: 95,
      color: "#fb7185",
      handwritten: true,
      zIndex: 4,
    }),
    createCanvasObject("frame", { x: 150, y: 520 }, {
      name: "Key points",
      text: "Key Points",
      width: 390,
      height: 250,
      color: "#fbbf24",
      fill: "rgba(251,191,36,.025)",
      zIndex: 1,
    }),
    createCanvasObject("checklist", { x: 175, y: 565 }, {
      name: "Mechanism checklist",
      text: "Backside attack\nInversion of configuration\nOne-step mechanism\nRate = k[R–LG][Nu⁻]",
      width: 340,
      height: 180,
      fill: "transparent",
      handwritten: true,
      zIndex: 5,
    }),
    createCanvasObject("sticky", { x: 690, y: 530 }, {
      name: "Worked example",
      text: "Example:\n\nCH₃Br + OH⁻ → CH₃OH + Br⁻\n\nBromoethane + hydroxide → methanol + bromide ion",
      width: 400,
      height: 260,
      fill: "#573a73",
      zIndex: 5,
    }),
    createCanvasObject("line", { x: 345, y: 330 }, {
      name: "Attack arrow",
      width: 130,
      height: 55,
      color: "#e4e4e7",
      lineStyle: "curved",
      arrowEnd: true,
      zIndex: 4,
    }),
  ];
  return objects;
}

export function objectBounds(objects: CanvasObject[]) {
  if (!objects.length) return { x: 0, y: 0, width: 1, height: 1 };
  const left = Math.min(...objects.map((object) => object.x));
  const top = Math.min(...objects.map((object) => object.y));
  const right = Math.max(...objects.map((object) => object.x + object.width));
  const bottom = Math.max(...objects.map((object) => object.y + object.height));
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
