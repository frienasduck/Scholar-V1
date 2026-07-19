"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import {
  MousePointer2, Hand, Lasso, Pen, Highlighter, Pencil, Brush, Eraser,
  Square, Circle as CircleIcon, Triangle as TriangleIcon, ArrowRight, Minus,
  Spline, Type as TypeIcon, StickyNote, Brain, Image as ImageIcon, Sigma,
  Undo2, Redo2, Trash2, ChevronDown, Save, Download, Layers as LayersIcon,
  Eye, EyeOff, Lock, Unlock, Plus, ZoomIn, ZoomOut, Check, Palette,
  Map as MapIcon, Sparkles, FileText, Workflow, KanbanSquare, CalendarDays,
  CircleDot, LayoutGrid, FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";

// ===== Liquid-glass styles (cv- prefix) =====
const CV_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&display=swap');
.cv-font { font-family: 'Barlow', system-ui, sans-serif; }
.cv-serif { font-family: 'Instrument Serif', Georgia, serif; }
.cv-glass { background:rgba(255,255,255,0.01); backdrop-filter:blur(4px); border:none; box-shadow:inset 0 1px 1px rgba(255,255,255,0.1); position:relative; overflow:hidden; }
.cv-glass::before { content:""; position:absolute; inset:0; border-radius:inherit; padding:1.4px; background:linear-gradient(180deg,rgba(255,255,255,0.45) 0%,rgba(255,255,255,0.15) 20%,rgba(255,255,255,0) 40%,rgba(255,255,255,0) 60%,rgba(255,255,255,0.15) 80%,rgba(255,255,255,0.45) 100%); -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); -webkit-mask-composite:xor; mask-composite:exclude; pointer-events:none; }
.cv-glass-strong { background:rgba(255,255,255,0.01); backdrop-filter:blur(50px); border:none; box-shadow:4px 4px 4px rgba(0,0,0,0.05),inset 0 1px 1px rgba(255,255,255,0.15); position:relative; overflow:hidden; }
.cv-glass-strong::before { content:""; position:absolute; inset:0; border-radius:inherit; padding:1.4px; background:linear-gradient(180deg,rgba(255,255,255,0.5) 0%,rgba(255,255,255,0.2) 20%,rgba(255,255,255,0) 40%,rgba(255,255,255,0) 60%,rgba(255,255,255,0.2) 80%,rgba(255,255,255,0.5) 100%); -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); -webkit-mask-composite:xor; mask-composite:exclude; pointer-events:none; }
.cv-scroll::-webkit-scrollbar { width:6px; height:6px; }
.cv-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:3px; }
.cv-scroll::-webkit-scrollbar-track { background:transparent; }
@media (max-width: 767px) {
  .cv-topbar { left:.5rem !important; right:.5rem; transform:none !important; overflow-x:auto; justify-content:flex-start; }
  .cv-toolrail { top:auto !important; bottom:3.25rem; left:50% !important; transform:translateX(-50%) !important; flex-direction:row !important; max-width:calc(100vw - 1rem); overflow-x:auto; }
  .cv-properties { display:none !important; }
  .cv-toolrail .cv-divider { width:1px; height:1.5rem; margin:.25rem; }
}
`;

// ===== Types =====
type Point = { x: number; y: number };
type CanvasType =
  | "blackboard" | "whiteboard" | "paper" | "graph" | "ruled" | "dot" | "dark";
type ToolId =
  | "select" | "hand" | "lasso" | "pen" | "marker" | "pencil" | "brush" | "chalk"
  | "eraser" | "rect" | "circle" | "triangle" | "arrow" | "line" | "connector"
  | "text" | "sticky" | "mindmap" | "image" | "formula";

interface Stroke {
  id: string;
  tool: string;
  color: string;
  opacity: number;
  width: number;
  points: Point[];
  shape?: string;
  text?: string;
  layerId: string;
}

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

interface BoardState {
  strokes: Stroke[];
  layers: Layer[];
  activeLayer: string;
  type: CanvasType;
  name: string;
  pan: Point;
  zoom: number;
  savedAt: number;
}

// ===== Canvas types =====
const CANVAS_TYPES: { id: CanvasType; label: string; preview: string; bg: string; fg: string }[] = [
  { id: "blackboard", label: "Blackboard", preview: "#0a0a0a", bg: "#0a0a0a", fg: "#ffffff" },
  { id: "whiteboard", label: "Whiteboard", preview: "#f8f8f8", bg: "#f8f8f8", fg: "#1a1a1a" },
  { id: "paper", label: "Plain Paper", preview: "#fdfaf3", bg: "#fdfaf3", fg: "#1a1a1a" },
  { id: "graph", label: "Graph Paper", preview: "#eef5ee", bg: "#eef5ee", fg: "#1a1a1a" },
  { id: "ruled", label: "Ruled Notebook", preview: "#f6f3ee", bg: "#f6f3ee", fg: "#1a1a1a" },
  { id: "dot", label: "Dot Grid", preview: "#1a1a1a", bg: "#1a1a1a", fg: "#ffffff" },
  { id: "dark", label: "Dark", preview: "#0f0f12", bg: "#0f0f12", fg: "#ffffff" },
];

// ===== Tools metadata =====
const TOOLS: { id: ToolId; label: string; icon: typeof Pen; key?: string; divider?: boolean }[] = [
  { id: "select", label: "Select", icon: MousePointer2, key: "V" },
  { id: "hand", label: "Hand (Pan)", icon: Hand, key: "H" },
  { id: "lasso", label: "Lasso", icon: Lasso },
  { id: "pen", label: "Pen", icon: Pen, key: "P" },
  { id: "marker", label: "Marker", icon: Highlighter, key: "M" },
  { id: "pencil", label: "Pencil", icon: Pencil },
  { id: "brush", label: "Brush", icon: Brush },
  { id: "chalk", label: "Chalk", icon: Pen },
  { id: "eraser", label: "Eraser", icon: Eraser, key: "E", divider: true },
  { id: "rect", label: "Rectangle", icon: Square, key: "R" },
  { id: "circle", label: "Circle", icon: CircleIcon, key: "C" },
  { id: "triangle", label: "Triangle", icon: TriangleIcon },
  { id: "arrow", label: "Arrow", icon: ArrowRight },
  { id: "line", label: "Line", icon: Minus },
  { id: "connector", label: "Connector", icon: Spline },
  { id: "text", label: "Text", icon: TypeIcon, key: "T", divider: true },
  { id: "sticky", label: "Sticky Note", icon: StickyNote, key: "N" },
  { id: "mindmap", label: "Mind Map Node", icon: Brain },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "formula", label: "Formula", icon: Sigma },
];

const BOTTOM_TOOLS: { id: "undo" | "redo" | "clear"; label: string; icon: typeof Pen }[] = [
  { id: "undo", label: "Undo", icon: Undo2 },
  { id: "redo", label: "Redo", icon: Redo2 },
  { id: "clear", label: "Clear", icon: Trash2 },
];

const PRESET_COLORS = [
  "#ffffff", "#fbbf24", "#f97316", "#ef4444", "#ec4899",
  "#a855f7", "#6366f1", "#3b82f6", "#14b8a6", "#22c55e",
  "#84cc16", "#eab308", "#94a3b8", "#475569", "#1e293b", "#000000",
];

// ===== Templates =====
const TEMPLATES: { id: string; label: string; icon: typeof Pen; desc: string }[] = [
  { id: "cornell", label: "Cornell Notes", icon: FileText, desc: "Cue / Notes / Summary layout" },
  { id: "mindmap", label: "Mind Map", icon: Brain, desc: "Central topic with branches" },
  { id: "flowchart", label: "Flowchart", icon: Workflow, desc: "Decision tree with shapes" },
  { id: "kanban", label: "Kanban Board", icon: KanbanSquare, desc: "To Do / Doing / Done columns" },
  { id: "weekly", label: "Weekly Planner", icon: CalendarDays, desc: "Mon–Sun grid" },
  { id: "venn", label: "Venn Diagram", icon: CircleDot, desc: "Three overlapping sets" },
  { id: "swot", label: "SWOT Analysis", icon: LayoutGrid, desc: "Strengths / Weak / Opp / Threats" },
  { id: "labreport", label: "Lab Report", icon: FlaskConical, desc: "Aim / Method / Observation" },
];

const STORAGE_KEY = "cv-board";
const MAX_UNDO = 50;

// ===== Helpers =====
const uid = () => Math.random().toString(36).slice(2, 10);

function defaultLayer(): Layer {
  return { id: "layer-1", name: "Layer 1", visible: true, locked: false, opacity: 1 };
}

function defaultBoard(): BoardState {
  return {
    strokes: [],
    layers: [defaultLayer()],
    activeLayer: "layer-1",
    type: "blackboard",
    name: "Untitled Board",
    pan: { x: 0, y: 0 },
    zoom: 100,
    savedAt: 0,
  };
}

function loadBoard(scholarClass: 9 | 11): BoardState {
  const parsed = profileGetJSON<Partial<BoardState>>(scholarClass, STORAGE_KEY, {});
  return { ...defaultBoard(), ...parsed };
}

// ===== Template builders (return strokes in board coordinates) =====
function buildTemplate(id: string): Stroke[] {
  const base: Omit<Stroke, "id" | "layerId"> = {
    tool: "rect", color: "#ffffff", opacity: 0.9, width: 2, points: [], shape: "rect",
  };
  const make = (overrides: Partial<Stroke> & { points: Point[] }): Stroke => ({
    id: uid(), layerId: "layer-1", tool: "rect", color: "#ffffff", opacity: 0.9, width: 2, ...overrides,
  });

  if (id === "cornell") {
    return [
      make({ shape: "rect", color: "#fbbf24", points: [{ x: 80, y: 60 }, { x: 1040, y: 700 }] }),
      make({ shape: "line", color: "#94a3b8", points: [{ x: 340, y: 60 }, { x: 340, y: 700 }] }),
      make({ shape: "line", color: "#94a3b8", points: [{ x: 80, y: 600 }, { x: 1040, y: 600 }] }),
      make({ tool: "text", color: "#ffffff", text: "CORNELL NOTES", points: [{ x: 90, y: 40 }], width: 18 }),
      make({ tool: "text", color: "#94a3b8", text: "Cues", points: [{ x: 100, y: 90 }], width: 14 }),
      make({ tool: "text", color: "#94a3b8", text: "Notes", points: [{ x: 360, y: 90 }], width: 14 }),
      make({ tool: "text", color: "#94a3b8", text: "Summary", points: [{ x: 90, y: 620 }], width: 14 }),
    ];
  }
  if (id === "mindmap") {
    const cx = 560, cy = 380;
    const nodes = [
      { x: cx, y: cy, t: "Topic" },
      { x: cx - 280, y: cy - 160, t: "Branch 1" },
      { x: cx + 280, y: cy - 160, t: "Branch 2" },
      { x: cx - 280, y: cy + 160, t: "Branch 3" },
      { x: cx + 280, y: cy + 160, t: "Branch 4" },
    ];
    const strokes: Stroke[] = [];
    nodes.forEach((n, i) => {
      if (i > 0) strokes.push(make({ shape: "line", color: "#6366f1", points: [{ x: cx, y: cy }, { x: n.x, y: n.y }], width: 2 }));
      strokes.push(make({ shape: "circle", color: i === 0 ? "#fbbf24" : "#14b8a6", points: [{ x: n.x - 60, y: n.y - 24 }, { x: n.x + 60, y: n.y + 24 }], width: 2 }));
      strokes.push(make({ tool: "text", color: "#ffffff", text: n.t, points: [{ x: n.x - 30, y: n.y + 4 }], width: 13 }));
    });
    return strokes;
  }
  if (id === "flowchart") {
    return [
      make({ shape: "rect", color: "#14b8a6", points: [{ x: 460, y: 60 }, { x: 660, y: 120 }] }),
      make({ tool: "text", color: "#ffffff", text: "Start", points: [{ x: 530, y: 96 }], width: 13 }),
      make({ shape: "line", color: "#94a3b8", points: [{ x: 560, y: 120 }, { x: 560, y: 170 }] }),
      make({ shape: "circle", color: "#a855f7", points: [{ x: 460, y: 170 }, { x: 660, y: 240 }] }),
      make({ tool: "text", color: "#ffffff", text: "Decision?", points: [{ x: 500, y: 210 }], width: 12 }),
      make({ shape: "line", color: "#94a3b8", points: [{ x: 560, y: 240 }, { x: 560, y: 290 }] }),
      make({ shape: "rect", color: "#f97316", points: [{ x: 460, y: 290 }, { x: 660, y: 350 }] }),
      make({ tool: "text", color: "#ffffff", text: "End", points: [{ x: 540, y: 326 }], width: 13 }),
    ];
  }
  if (id === "kanban") {
    const cols = [
      { x: 80, t: "TO DO" }, { x: 420, t: "DOING" }, { x: 760, t: "DONE" },
    ];
    const strokes: Stroke[] = [];
    cols.forEach((c) => {
      strokes.push(make({ shape: "rect", color: "#475569", points: [{ x: c.x, y: 80 }, { x: c.x + 280, y: 600 }], width: 2 }));
      strokes.push(make({ tool: "text", color: "#fbbf24", text: c.t, points: [{ x: c.x + 20, y: 110 }], width: 16 }));
    });
    strokes.push(make({ shape: "rect", color: "#14b8a6", points: [{ x: 100, y: 140 }, { x: 340, y: 200 }] }));
    strokes.push(make({ tool: "text", color: "#ffffff", text: "Task A", points: [{ x: 120, y: 175 }], width: 13 }));
    strokes.push(make({ shape: "rect", color: "#f97316", points: [{ x: 440, y: 140 }, { x: 680, y: 200 }] }));
    strokes.push(make({ tool: "text", color: "#ffffff", text: "Task B", points: [{ x: 460, y: 175 }], width: 13 }));
    strokes.push(make({ shape: "rect", color: "#22c55e", points: [{ x: 780, y: 140 }, { x: 1020, y: 200 }] }));
    strokes.push(make({ tool: "text", color: "#ffffff", text: "Task C", points: [{ x: 800, y: 175 }], width: 13 }));
    return strokes;
  }
  if (id === "weekly") {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const strokes: Stroke[] = [];
    strokes.push(make({ shape: "rect", color: "#475569", points: [{ x: 60, y: 80 }, { x: 1060, y: 640 }], width: 2 }));
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 143;
      strokes.push(make({ shape: "line", color: "#94a3b8", points: [{ x: x + 143, y: 80 }, { x: x + 143, y: 640 }], width: 1 }));
      strokes.push(make({ tool: "text", color: "#fbbf24", text: days[i], points: [{ x: x + 12, y: 110 }], width: 13 }));
    }
    strokes.push(make({ shape: "line", color: "#94a3b8", points: [{ x: 60, y: 130 }, { x: 1060, y: 130 }], width: 1 }));
    return strokes;
  }
  if (id === "venn") {
    return [
      make({ shape: "circle", color: "#6366f1", opacity: 0.5, points: [{ x: 360, y: 200 }, { x: 660, y: 500 }] }),
      make({ shape: "circle", color: "#14b8a6", opacity: 0.5, points: [{ x: 540, y: 200 }, { x: 840, y: 500 }] }),
      make({ shape: "circle", color: "#a855f7", opacity: 0.5, points: [{ x: 450, y: 320 }, { x: 750, y: 620 }] }),
      make({ tool: "text", color: "#ffffff", text: "Set A", points: [{ x: 400, y: 340 }], width: 14 }),
      make({ tool: "text", color: "#ffffff", text: "Set B", points: [{ x: 760, y: 340 }], width: 14 }),
      make({ tool: "text", color: "#ffffff", text: "Set C", points: [{ x: 580, y: 580 }], width: 14 }),
    ];
  }
  if (id === "swot") {
    const labels = [
      { x: 80, y: 80, t: "Strengths", c: "#22c55e" },
      { x: 560, y: 80, t: "Weaknesses", c: "#ef4444" },
      { x: 80, y: 380, t: "Opportunities", c: "#14b8a6" },
      { x: 560, y: 380, t: "Threats", c: "#f97316" },
    ];
    const strokes: Stroke[] = [];
    labels.forEach((l) => {
      strokes.push(make({ shape: "rect", color: l.c, points: [{ x: l.x, y: l.y }, { x: l.x + 440, y: l.y + 260 }], width: 2 }));
      strokes.push(make({ tool: "text", color: l.c, text: l.t, points: [{ x: l.x + 20, y: l.y + 30 }], width: 18 }));
    });
    return strokes;
  }
  if (id === "labreport") {
    const rows = ["Aim", "Materials", "Method", "Observation", "Conclusion"];
    const strokes: Stroke[] = [];
    strokes.push(make({ shape: "rect", color: "#475569", points: [{ x: 60, y: 60 }, { x: 1060, y: 660 }], width: 2 }));
    rows.forEach((r, i) => {
      const y = 100 + i * 110;
      strokes.push(make({ shape: "line", color: "#94a3b8", points: [{ x: 60, y }, { x: 1060, y }], width: 1 }));
      strokes.push(make({ tool: "text", color: "#fbbf24", text: r, points: [{ x: 80, y: y + 30 }], width: 16 }));
    });
    return strokes;
  }
  return [];
}

// ===== Component =====
export function CanvasView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);

  const [board, setBoard] = useState<BoardState>(() => loadBoard(scholarClass));
  const [tool, setTool] = useState<ToolId>("pen");
  const [color, setColor] = useState("#ffffff");
  const [opacity, setOpacity] = useState(1);
  const [width, setWidth] = useState(3);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const [savedAt, setSavedAt] = useState<number>(board.savedAt || 0);
  const [editingName, setEditingName] = useState(false);

  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const lastPointer = useRef<Point>({ x: 0, y: 0 });
  const currentStroke = useRef<Stroke | null>(null);
  const spaceDown = useRef(false);
  const shapeStart = useRef<Point | null>(null);
  const boardRef = useRef(board);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const opacityRef = useRef(opacity);
  const widthRef = useRef(width);
  const drawScheduled = useRef(false);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { opacityRef.current = opacity; }, [opacity]);
  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = loadBoard(scholarClass);
      setBoard(next);
      setSavedAt(next.savedAt || 0);
      setHistory([]);
      setRedoStack([]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [scholarClass]);

  const activeTool = useMemo(() => TOOLS.find((t) => t.id === tool), [tool]);
  const activeLayer = useMemo(
    () => board.layers.find((l) => l.id === board.activeLayer) || board.layers[0],
    [board.layers, board.activeLayer],
  );

  // ===== Persistence =====
  const persist = useCallback((b: BoardState) => {
    const at = Date.now();
    profileSetJSON(scholarClass, STORAGE_KEY, { ...b, savedAt: at });
    setSavedAt(at);
  }, [scholarClass]);

  // Autosave every 5s if changed
  useEffect(() => {
    const id = setInterval(() => {
      if (board.strokes.length > 0) persist(boardRef.current);
    }, 5000);
    return () => clearInterval(id);
  }, [persist]);

  // ===== Drawing =====
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, type: CanvasType) => {
    const cfg = CANVAS_TYPES.find((c) => c.id === type)!;
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(0, 0, w, h);

    if (type === "graph") {
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    } else if (type === "ruled") {
      ctx.strokeStyle = "rgba(99,102,241,0.18)";
      ctx.lineWidth = 1;
      for (let y = 32; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = "rgba(239,68,68,0.35)";
      ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(60, h); ctx.stroke();
    } else if (type === "dot") {
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      for (let x = 0; x < w; x += 24) {
        for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill(); }
      }
    } else if (type === "whiteboard" || type === "paper") {
      // subtle warmth already from bg
    }
  }, []);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke, layer: Layer | undefined) => {
    if (layer && !layer.visible) return;
    const layerOpacity = layer ? layer.opacity : 1;
    ctx.save();
    ctx.globalAlpha = s.opacity * layerOpacity;

    const pts = s.points;
    if (pts.length === 0) { ctx.restore(); return; }

    if (s.tool === "text" || s.tool === "sticky" || s.tool === "mindmap" || s.tool === "formula") {
      const pos = pts[0];
      if (s.tool === "sticky") {
        ctx.fillStyle = "rgba(251,191,36,0.9)";
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillRect(pos.x, pos.y, 180, 120);
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "14px Barlow, sans-serif";
        const text = s.text || "Note";
        text.split("\n").forEach((line, i) => ctx.fillText(line, pos.x + 14, pos.y + 30 + i * 20));
      } else if (s.tool === "mindmap") {
        ctx.fillStyle = "rgba(99,102,241,0.85)";
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, 90, 32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px Barlow, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.text || "Node", pos.x, pos.y + 5);
        ctx.textAlign = "left";
      } else {
        ctx.fillStyle = s.color;
        ctx.font = `${Math.max(12, s.width * 4)}px Barlow, sans-serif`;
        const text = s.text || "Text";
        text.split("\n").forEach((line, i) => ctx.fillText(line, pos.x, pos.y + i * (s.width * 4 + 4)));
      }
      ctx.restore();
      return;
    }

    if (s.shape === "rect" && pts.length >= 2) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.strokeRect(pts[0].x, pts[0].y, pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    } else if (s.shape === "circle" && pts.length >= 2) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const rx = Math.abs(pts[1].x - pts[0].x) / 2;
      const ry = Math.abs(pts[1].y - pts[0].y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.shape === "triangle" && pts.length >= 2) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      const x0 = pts[0].x, y0 = pts[1].y, x1 = pts[1].x;
      ctx.beginPath();
      ctx.moveTo((x0 + x1) / 2, pts[0].y);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x1, y0);
      ctx.closePath();
      ctx.stroke();
    } else if ((s.shape === "line" || s.shape === "connector") && pts.length >= 2) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      if (s.shape === "connector") {
        // small circle endpoints
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(pts[1].x, pts[1].y, 4, 0, Math.PI * 2); ctx.fill();
      }
    } else if (s.shape === "arrow" && pts.length >= 2) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.width;
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const ang = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      const ah = 12 + s.width * 2;
      ctx.beginPath();
      ctx.moveTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[1].x - ah * Math.cos(ang - 0.4), pts[1].y - ah * Math.sin(ang - 0.4));
      ctx.lineTo(pts[1].x - ah * Math.cos(ang + 0.4), pts[1].y - ah * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fill();
    } else if (s.tool === "eraser" && pts.length > 0) {
      // eraser leaves no stroke on its own — handled via destination-out at draw time only
      // for persistence we skip rendering eraser strokes
    } else {
      // freehand drawing engine
      if (pts.length < 2) { ctx.restore(); return; }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (s.tool === "pen") {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      } else if (s.tool === "marker") {
        ctx.globalAlpha = s.opacity * 0.5 * layerOpacity;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width * 2.4;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      } else if (s.tool === "pencil") {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width * 0.6;
        ctx.globalAlpha = s.opacity * 0.7 * layerOpacity;
        for (let i = 1; i < pts.length; i++) {
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
        // graphite texture
        for (let i = 0; i < pts.length; i += 2) {
          ctx.fillStyle = s.color;
          ctx.globalAlpha = Math.random() * 0.15 * layerOpacity;
          ctx.beginPath();
          ctx.arc(pts[i].x + (Math.random() - 0.5) * 2, pts[i].y + (Math.random() - 0.5) * 2, 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (s.tool === "brush") {
        ctx.strokeStyle = s.color;
        for (let i = 1; i < pts.length; i++) {
          const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          ctx.lineWidth = Math.max(1, s.width * (1.8 - Math.min(1, d / 12)));
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
      } else if (s.tool === "chalk") {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.globalAlpha = s.opacity * 0.85 * layerOpacity;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        // chalk dust
        for (let i = 0; i < pts.length; i++) {
          ctx.fillStyle = s.color;
          ctx.globalAlpha = Math.random() * 0.25 * layerOpacity;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc(pts[i].x + (Math.random() - 0.5) * s.width * 2, pts[i].y + (Math.random() - 0.5) * s.width * 2, 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }, []);

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    drawBackground(ctx, w, h, board.type);

    const z = board.zoom / 100;
    ctx.save();
    ctx.translate(board.pan.x, board.pan.y);
    ctx.scale(z, z);

    for (const stroke of board.strokes) {
      const layer = board.layers.find((l) => l.id === stroke.layerId);
      drawStroke(ctx, stroke, layer);
    }
    if (currentStroke.current) {
      drawStroke(ctx, currentStroke.current, board.layers.find((l) => l.id === currentStroke.current!.layerId));
    }
    ctx.restore();
  }, [board, drawBackground, drawStroke]);

  const scheduleDraw = useCallback(() => {
    if (drawScheduled.current) return;
    drawScheduled.current = true;
    requestAnimationFrame(() => {
      drawScheduled.current = false;
      drawAll();
      // minimap
      const mm = minimapRef.current;
      const canvas = canvasRef.current;
      if (mm && canvas) {
        const mctx = mm.getContext("2d");
        if (mctx) {
          mctx.fillStyle = "#000";
          mctx.fillRect(0, 0, mm.width, mm.height);
          mctx.drawImage(canvas, 0, 0, mm.width, mm.height);
          // viewport box
          const z = board.zoom / 100;
          mctx.strokeStyle = "rgba(251,191,36,0.9)";
          mctx.lineWidth = 1;
          const vx = (-board.pan.x / z) / canvas.width * mm.width;
          const vy = (-board.pan.y / z) / canvas.height * mm.height;
          const vw = (canvas.width / z) / canvas.width * mm.width;
          const vh = (canvas.height / z) / canvas.height * mm.height;
          mctx.strokeRect(vx, vy, vw, vh);
        }
      }
    });
  }, [drawAll, board.zoom, board.pan]);

  // Redraw on board/zoom/pan changes
  useEffect(() => { scheduleDraw(); }, [scheduleDraw, board]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => scheduleDraw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [scheduleDraw]);

  // ===== Pointer math =====
  const toBoard = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const z = boardRef.current.zoom / 100;
    return {
      x: (clientX - rect.left - boardRef.current.pan.x) / z,
      y: (clientY - rect.top - boardRef.current.pan.y) / z,
    };
  }, []);

  // ===== History =====
  const pushHistory = useCallback((prev: Stroke[]) => {
    setHistory((h) => {
      const next = [...h, prev];
      if (next.length > MAX_UNDO) next.shift();
      return next;
    });
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setRedoStack((r) => [...r, boardRef.current.strokes]);
      setBoard((b) => ({ ...b, strokes: last }));
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setHistory((h) => [...h, boardRef.current.strokes]);
      setBoard((b) => ({ ...b, strokes: next }));
      return r.slice(0, -1);
    });
  }, []);

  const clearBoard = useCallback(() => {
    if (boardRef.current.strokes.length === 0) return;
    pushHistory(boardRef.current.strokes);
    setBoard((b) => ({ ...b, strokes: [] }));
    toast.success("Canvas cleared");
  }, [pushHistory]);

  // ===== Pointer events =====
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || spaceDown.current || toolRef.current === "hand") {
      isPanning.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    const t = toolRef.current;
    if (activeLayer?.locked) {
      toast.error("Active layer is locked");
      return;
    }
    const bp = toBoard(e.clientX, e.clientY);
    isDrawing.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (t === "text" || t === "formula") {
      const txt = window.prompt(t === "formula" ? "Enter formula (LaTeX-like):" : "Enter text:", "");
      if (txt && txt.trim()) {
        pushHistory(boardRef.current.strokes);
        const s: Stroke = {
          id: uid(), tool: t, color: colorRef.current, opacity: opacityRef.current,
          width: widthRef.current, points: [bp], text: txt, layerId: boardRef.current.activeLayer,
        };
        setBoard((b) => ({ ...b, strokes: [...b.strokes, s] }));
        addXP(1);
      }
      isDrawing.current = false;
      return;
    }
    if (t === "sticky" || t === "mindmap") {
      pushHistory(boardRef.current.strokes);
      const txt = window.prompt(t === "sticky" ? "Sticky note text:" : "Node label:", t === "sticky" ? "Note" : "Node");
      const s: Stroke = {
        id: uid(), tool: t, color: colorRef.current, opacity: opacityRef.current,
        width: widthRef.current, points: [bp], text: txt || (t === "sticky" ? "Note" : "Node"), layerId: boardRef.current.activeLayer,
      };
      setBoard((b) => ({ ...b, strokes: [...b.strokes, s] }));
      addXP(1);
      isDrawing.current = false;
      return;
    }
    if (t === "image") {
      const url = window.prompt("Image URL (https://...):", "");
      if (url) {
        pushHistory(boardRef.current.strokes);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const s: Stroke = {
            id: uid(), tool: "image", color: "", opacity: 1, width: 200, points: [bp], shape: "image", text: url, layerId: boardRef.current.activeLayer,
          };
          setBoard((b) => ({ ...b, strokes: [...b.strokes, s] }));
        };
        img.src = url;
      }
      isDrawing.current = false;
      return;
    }
    if (t === "select" || t === "lasso") {
      // simple: do nothing major
      isDrawing.current = false;
      return;
    }

    const isShape = ["rect", "circle", "triangle", "arrow", "line", "connector"].includes(t);
    if (isShape) {
      shapeStart.current = bp;
      currentStroke.current = {
        id: uid(), tool: t, color: colorRef.current, opacity: opacityRef.current,
        width: widthRef.current, points: [bp, bp], shape: t, layerId: boardRef.current.activeLayer,
      };
    } else {
      currentStroke.current = {
        id: uid(), tool: t, color: colorRef.current, opacity: opacityRef.current,
        width: widthRef.current, points: [bp], layerId: boardRef.current.activeLayer,
      };
    }
  }, [activeLayer, toBoard, pushHistory, addXP]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const bp = toBoard(e.clientX, e.clientY);
      setCursor(bp);
    }
    if (isPanning.current) {
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setBoard((b) => ({ ...b, pan: { x: b.pan.x + dx, y: b.pan.y + dy } }));
      return;
    }
    if (!isDrawing.current || !currentStroke.current) return;
    const bp = toBoard(e.clientX, e.clientY);
    const s = currentStroke.current;
    if (s.shape) {
      s.points = [s.points[0], bp];
    } else {
      s.points.push(bp);
    }
    scheduleDraw();
  }, [toBoard, scheduleDraw]);

  const onPointerUp = useCallback(() => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    if (!isDrawing.current || !currentStroke.current) return;
    const s = currentStroke.current;
    if (s.points.length > 0 && (s.shape || s.points.length > 1)) {
      pushHistory(boardRef.current.strokes);
      setBoard((b) => ({ ...b, strokes: [...b.strokes, s] }));
    }
    currentStroke.current = null;
    isDrawing.current = false;
  }, [pushHistory]);

  // ===== Wheel zoom =====
  const onWheel = useCallback((e: React.WheelEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setBoard((b) => {
      const oldZ = b.zoom / 100;
      const newZoom = Math.max(10, Math.min(500, b.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      const newZ = newZoom / 100;
      const wx = (mx - b.pan.x) / oldZ;
      const wy = (my - b.pan.y) / oldZ;
      return { ...b, zoom: newZoom, pan: { x: mx - wx * newZ, y: my - wy * newZ } };
    });
  }, []);

  // ===== Keyboard shortcuts =====
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.code === "Space") { spaceDown.current = true; setSpaceHeld(true); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault(); redo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); persist(boardRef.current); toast.success("Board saved"); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault(); clearBoard(); return;
      }
      const keyMap: Record<string, ToolId> = {
        v: "select", h: "hand", p: "pen", m: "marker", e: "eraser",
        r: "rect", c: "circle", t: "text", n: "sticky",
      };
      const k = e.key.toLowerCase();
      if (keyMap[k] && !e.ctrlKey && !e.metaKey) setTool(keyMap[k]);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") { spaceDown.current = false; setSpaceHeld(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [undo, redo, persist, clearBoard]);

  // ===== Actions =====
  const applyTemplate = useCallback((id: string) => {
    pushHistory(boardRef.current.strokes);
    const newStrokes = buildTemplate(id);
    setBoard((b) => ({ ...b, strokes: newStrokes }));
    const label = TEMPLATES.find((t) => t.id === id)?.label || id;
    toast.success(`Loaded "${label}" template`);
    addXP(2);
    pushActivity({ type: "canvas", icon: "✨", text: `Applied ${label} template on canvas` });
  }, [pushHistory, addXP, pushActivity]);

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${(board.name || "board").replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("PNG exported");
    addXP(1);
  }, [board.name, addXP]);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${(board.name || "board").replace(/\s+/g, "-").toLowerCase()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exported");
  }, [board]);

  const saveBoard = useCallback(() => {
    persist(boardRef.current);
    toast.success("Board saved to browser");
    pushActivity({ type: "canvas", icon: "💾", text: `Saved canvas "${boardRef.current.name}"` });
    addXP(1);
  }, [persist, addXP, pushActivity]);

  const setZoom = useCallback((z: number) => {
    setBoard((b) => ({ ...b, zoom: Math.max(10, Math.min(500, z)) }));
  }, []);

  const setBoardType = useCallback((t: CanvasType) => {
    setBoard((b) => ({ ...b, type: t }));
  }, []);

  // ===== Layers =====
  const addLayer = useCallback(() => {
    setBoard((b) => {
      const id = `layer-${b.layers.length + 1}-${uid()}`;
      return {
        ...b,
        layers: [...b.layers, { id, name: `Layer ${b.layers.length + 1}`, visible: true, locked: false, opacity: 1 }],
        activeLayer: id,
      };
    });
  }, []);

  const toggleLayerVis = useCallback((id: string) => {
    setBoard((b) => ({ ...b, layers: b.layers.map((l) => l.id === id ? { ...l, visible: !l.visible } : l) }));
  }, []);
  const toggleLayerLock = useCallback((id: string) => {
    setBoard((b) => ({ ...b, layers: b.layers.map((l) => l.id === id ? { ...l, locked: !l.locked } : l) }));
  }, []);
  const setLayerOpacity = useCallback((id: string, op: number) => {
    setBoard((b) => ({ ...b, layers: b.layers.map((l) => l.id === id ? { ...l, opacity: op } : l) }));
  }, []);

  const savedLabel = savedAt > 0 ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not saved";

  return (
    <div className="-m-4 lg:-m-6 bg-black cv-font" style={{ minHeight: "calc(100vh - 4rem)" }}>
      <style dangerouslySetInnerHTML={{ __html: CV_STYLE }} />
      <div ref={containerRef} className="relative w-full overflow-hidden" style={{ minHeight: "calc(100vh - 4rem)" }}>
        {/* ===== Top bar ===== */}
        <div className="cv-topbar absolute top-3 left-1/2 -translate-x-1/2 z-30 cv-glass rounded-2xl px-2 py-1.5 flex items-center gap-1.5 cv-font max-w-[94vw]">
          {/* Type dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white/80 text-xs cv-font">
                <span className="w-3 h-3 rounded-sm border border-white/20" style={{ background: CANVAS_TYPES.find((c) => c.id === board.type)?.preview }} />
                {CANVAS_TYPES.find((c) => c.id === board.type)?.label}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-zinc-900 border-white/10 cv-font">
              <DropdownMenuLabel className="text-white/50 text-[10px] uppercase tracking-wider">Canvas Type</DropdownMenuLabel>
              {CANVAS_TYPES.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => setBoardType(c.id)} className="text-white/80 hover:bg-white/10 cursor-pointer text-xs">
                  <span className="w-4 h-4 rounded-sm border border-white/20" style={{ background: c.preview }} />
                  {c.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="w-px h-5 bg-white/10" />

          {/* Board name */}
          {editingName ? (
            <input
              autoFocus
              value={board.name}
              onChange={(e) => setBoard((b) => ({ ...b, name: e.target.value }))}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false); }}
              className="bg-transparent text-white text-xs px-2 py-1 outline-none border-b border-amber-400/50 w-32 cv-font"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="px-2 py-1.5 rounded-lg hover:bg-white/10 text-white text-xs cv-font max-w-[120px] truncate"
              title="Click to rename"
            >
              {board.name}
            </button>
          )}

          <span className="w-px h-5 bg-white/10" />

          <span className="text-[10px] text-white/40 px-1 hidden md:inline cv-font">{savedLabel}</span>

          <span className="w-px h-5 bg-white/10 hidden md:block" />

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => setZoom(board.zoom - 25)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setZoom(100)} className="text-white/70 text-[11px] w-10 text-center hover:bg-white/10 rounded-lg py-1 cv-font font-mono">
              {board.zoom}%
            </button>
            <button onClick={() => setZoom(board.zoom + 25)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="w-px h-5 bg-white/10" />

          {/* Templates */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white/80 text-xs cv-font">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Templates</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="bg-zinc-900 border-white/10 cv-font w-56">
              <DropdownMenuLabel className="text-white/50 text-[10px] uppercase tracking-wider">Templates</DropdownMenuLabel>
              {TEMPLATES.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => applyTemplate(t.id)} className="text-white/80 hover:bg-white/10 cursor-pointer">
                  <t.icon className="w-3.5 h-3.5 mr-2 text-teal-400" />
                  <div>
                    <div className="text-xs">{t.label}</div>
                    <div className="text-[10px] text-white/40">{t.desc}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="w-px h-5 bg-white/10" />

          <button onClick={saveBoard} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white/80 text-xs cv-font">
            <Save className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Save</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white/80 text-xs cv-font">
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Export</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 cv-font">
              <DropdownMenuItem onClick={exportPNG} className="text-white/80 hover:bg-white/10 cursor-pointer text-xs">Export as PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={exportJSON} className="text-white/80 hover:bg-white/10 cursor-pointer text-xs">Export as JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ===== Left toolbar ===== */}
        <div className="cv-toolrail absolute left-3 top-1/2 -translate-y-1/2 z-30 cv-glass-strong rounded-2xl p-1.5 flex flex-col gap-0.5 cv-font" role="toolbar" aria-label="Canvas tools">
          {TOOLS.map((t) => (
            <div key={t.id} className="relative group">
              {t.divider && <div className="cv-divider h-px bg-white/10 my-0.5" />}
              <button
                onClick={() => setTool(t.id)}
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center transition-all cv-font",
                  tool === t.id
                    ? "bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                    : "text-white/60 hover:text-white hover:bg-white/10",
                )}
                title={`${t.label}${t.key ? ` (${t.key})` : ""}`}
                aria-label={`${t.label}${t.key ? `, shortcut ${t.key}` : ""}`}
                aria-pressed={tool === t.id}
              >
                <t.icon className="w-4 h-4" />
              </button>
              <div className="absolute left-12 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-900 border border-white/10 rounded text-[10px] text-white/80 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                {t.label}{t.key && <span className="text-amber-400 ml-1">[{t.key}]</span>}
              </div>
            </div>
          ))}

          <div className="h-px bg-white/10 my-1" />

          {BOTTOM_TOOLS.map((t) => (
            <div key={t.id} className="relative group">
              <button
                onClick={() => {
                  if (t.id === "undo") undo();
                  else if (t.id === "redo") redo();
                  else clearBoard();
                }}
                disabled={t.id === "undo" && history.length === 0}
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center transition-all cv-font",
                  "text-white/60 hover:text-white hover:bg-white/10",
                  (t.id === "undo" && history.length === 0) && "opacity-30 cursor-not-allowed",
                )}
                title={t.label}
              >
                <t.icon className="w-4 h-4" />
              </button>
              <div className="absolute left-12 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-900 border border-white/10 rounded text-[10px] text-white/80 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                {t.label}
              </div>
            </div>
          ))}
        </div>

        {/* ===== Color & properties panel (above toolbar) ===== */}
        <div className="cv-properties absolute left-16 top-3 z-30 cv-glass rounded-2xl p-2 cv-font flex flex-col gap-2 max-w-[180px]">
          <button
            onClick={() => setShowColorPicker((v) => !v)}
            className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-white/10"
          >
            <span className="w-6 h-6 rounded-md border border-white/20" style={{ background: color }} />
            <span className="text-[10px] text-white/60">{color.toUpperCase()}</span>
            <Palette className="w-3 h-3 text-white/40 ml-auto" />
          </button>

          <AnimatePresence>
            {showColorPicker && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-8 gap-1 p-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setColor(c); }}
                      className={cn(
                        "w-4 h-4 rounded-sm border transition-transform hover:scale-110",
                        color === c ? "border-amber-400 ring-1 ring-amber-400" : "border-white/20",
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 px-1 pb-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 rounded bg-transparent cursor-pointer border border-white/20"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="bg-white/5 text-white text-[10px] px-2 py-1 rounded outline-none w-full font-mono"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="px-1">
            <div className="flex items-center justify-between text-[9px] text-white/40 mb-0.5">
              <span>Opacity</span><span className="font-mono">{Math.round(opacity * 100)}%</span>
            </div>
            <Slider value={[opacity * 100]} onValueChange={(v) => setOpacity(v[0] / 100)} min={5} max={100} step={1} />
          </div>
          <div className="px-1">
            <div className="flex items-center justify-between text-[9px] text-white/40 mb-0.5">
              <span>Width</span><span className="font-mono">{width}px</span>
            </div>
            <Slider value={[width]} onValueChange={(v) => setWidth(v[0])} min={1} max={40} step={1} />
          </div>
        </div>

        {/* ===== Layers panel toggle ===== */}
        <button
          onClick={() => setShowLayers((v) => !v)}
          className="absolute right-3 top-3 z-30 cv-glass rounded-xl px-3 py-2 flex items-center gap-1.5 text-white/80 text-xs hover:bg-white/10 cv-font"
        >
          <LayersIcon className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Layers</span>
          <span className="text-[10px] text-white/40 font-mono">{board.layers.length}</span>
        </button>

        <AnimatePresence>
          {showLayers && (
            <motion.div
              initial={{ x: 240, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 240, opacity: 0 }}
              className="absolute right-3 top-14 z-30 cv-glass-strong rounded-2xl p-3 w-56 cv-font"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs text-white/80 font-medium uppercase tracking-wider">Layers</h3>
                <button onClick={addLayer} className="p-1 rounded hover:bg-white/10 text-white/60">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto cv-scroll">
                {board.layers.map((l) => (
                  <div
                    key={l.id}
                    className={cn(
                      "rounded-lg p-2 border cursor-pointer transition-all",
                      board.activeLayer === l.id ? "bg-amber-400/10 border-amber-400/40" : "bg-white/5 border-white/10 hover:bg-white/10",
                    )}
                    onClick={() => setBoard((b) => ({ ...b, activeLayer: l.id }))}
                  >
                    <div className="flex items-center gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); toggleLayerVis(l.id); }} className="p-0.5 text-white/60 hover:text-white">
                        {l.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleLayerLock(l.id); }} className="p-0.5 text-white/60 hover:text-white">
                        {l.locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                      </button>
                      <span className="text-[11px] text-white/80 flex-1 truncate">{l.name}</span>
                      <span className="text-[9px] text-white/30 font-mono">
                        {board.strokes.filter((s) => s.layerId === l.id).length}
                      </span>
                    </div>
                    {board.activeLayer === l.id && (
                      <div className="mt-1.5 px-1">
                        <div className="flex items-center justify-between text-[9px] text-white/40 mb-0.5">
                          <span>Opacity</span><span className="font-mono">{Math.round(l.opacity * 100)}%</span>
                        </div>
                        <Slider value={[l.opacity * 100]} onValueChange={(v) => setLayerOpacity(l.id, v[0] / 100)} min={0} max={100} step={1} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== Canvas ===== */}
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={onWheel}
          className="absolute inset-0 touch-none"
          style={{ cursor: tool === "hand" || spaceHeld ? "grab" : "crosshair" }}
          role="img"
          aria-label={`${board.name}, an editable study canvas with ${board.strokes.length} items`}
          aria-describedby="canvas-accessible-summary"
          tabIndex={0}
        />

        <section id="canvas-accessible-summary" className="sr-only" aria-live="polite">
          <h2>Canvas contents</h2>
          <p>{board.layers.length} layers and {board.strokes.length} items. Use the labelled toolbar buttons or keyboard shortcuts to select tools.</p>
          <ul>{board.strokes.filter((stroke) => stroke.text).map((stroke) => <li key={stroke.id}>{stroke.tool}: {stroke.text}</li>)}</ul>
        </section>

        {/* ===== Minimap ===== */}
        <AnimatePresence>
          {showMinimap && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute right-3 bottom-3 z-20 cv-glass-strong rounded-xl p-2 cv-font"
            >
              <canvas ref={minimapRef} width={160} height={100} className="rounded-md" />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] text-white/40 font-mono">MINIMAP</span>
                <button onClick={() => setShowMinimap(false)} className="text-[9px] text-white/40 hover:text-white">hide</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showMinimap && (
          <button
            onClick={() => setShowMinimap(true)}
            className="absolute right-3 bottom-3 z-20 cv-glass rounded-lg p-2 text-white/60 hover:text-white"
          >
            <MapIcon className="w-3.5 h-3.5" />
          </button>
        )}

        {/* ===== Bottom status bar ===== */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 cv-glass rounded-full px-3 py-1.5 cv-font hidden md:flex items-center gap-3 text-[10px] text-white/60">
          <span className="font-mono">x: {Math.round(cursor.x)} y: {Math.round(cursor.y)}</span>
          <span className="w-px h-3 bg-white/20" />
          <span>{activeTool?.label}</span>
          <span className="w-px h-3 bg-white/20" />
          <span>{board.strokes.length} strokes</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="text-amber-400/80">Space+drag to pan · Wheel to zoom</span>
        </div>

        {/* Empty state hint */}
        {board.strokes.length === 0 && (
          <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none cv-font">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-md px-6"
            >
              <div className="text-6xl mb-4 cv-serif italic text-white/80">Infinite canvas</div>
              <p className="text-white/50 text-sm">
                Pick a tool from the left, then draw anywhere.<br />
                Try a template from the top bar, or just start sketching.
              </p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CanvasView;
