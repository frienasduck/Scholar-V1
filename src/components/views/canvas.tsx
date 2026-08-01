"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "@/lib/notifications/notification-api";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  BringToFront,
  Check,
  ChevronDown,
  Circle,
  Clipboard,
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Focus,
  Frame,
  Grid3X3,
  Group,
  Hand,
  Highlighter,
  Image as ImageIcon,
  Layers,
  Link2,
  ListChecks,
  Lock,
  Maximize2,
  MessageCircle,
  Minus,
  MoreHorizontal,
  MousePointer2,
  PanelRightOpen,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Search,
  SendToBack,
  Share2,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  Square,
  StickyNote,
  Table2,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Unlock,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { CanvasObjectRenderer } from "@/components/canvas/canvas-object-renderer";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import {
  CANVAS_STORAGE_KEY,
  canvasId,
  chemistryReactionTemplate,
  cloneCanvasProject,
  createBlankCanvasProject,
  createBlankPage,
  createCanvasObject,
  normalizeCanvasProject,
  objectBounds,
  type CanvasObject,
  type CanvasObjectType,
  type CanvasPage,
  type CanvasPoint,
  type CanvasProject,
} from "@/lib/canvas-workspace";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { setLamDraft, setLamPageContext } from "@/lib/lam-context";
import { navigateTo } from "@/lib/nav-event";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CanvasTool =
  | "select"
  | "hand"
  | "pen"
  | "highlighter"
  | "eraser"
  | "text"
  | "sticky"
  | "shape"
  | "line"
  | "arrow"
  | "connector"
  | "image"
  | "formula"
  | "table"
  | "frame"
  | "checklist"
  | "source";

type InspectorPanel = "pages" | "layers" | "properties" | "comments";

type ComposerState = {
  type: CanvasObjectType;
  at: CanvasPoint;
  editId?: string;
  text: string;
  name: string;
  sourceLabel?: string;
  sourceView?: string;
};

type Interaction =
  | {
      kind: "pan";
      startClient: CanvasPoint;
      viewport: CanvasPage["viewport"];
    }
  | {
      kind: "drag";
      startClient: CanvasPoint;
      originals: CanvasObject[];
      snapshot: CanvasProject;
      moved: boolean;
    }
  | {
      kind: "resize";
      startClient: CanvasPoint;
      object: CanvasObject;
      snapshot: CanvasProject;
      moved: boolean;
    }
  | {
      kind: "draw";
      snapshot: CanvasProject;
      startWorld: CanvasPoint;
    }
  | {
      kind: "marquee";
      startWorld: CanvasPoint;
    }
  | {
      kind: "pinch";
      distance: number;
      center: CanvasPoint;
      viewport: CanvasPage["viewport"];
    };

const MAX_HISTORY = 60;
const GRID_SIZE = 10;

const CORE_TOOLS: Array<{
  id: CanvasTool;
  label: string;
  icon: typeof MousePointer2;
  shortcut?: string;
  divider?: boolean;
}> = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { id: "hand", label: "Hand / Pan", icon: Hand, shortcut: "H" },
  { id: "text", label: "Text", icon: Type, shortcut: "T", divider: true },
  { id: "pen", label: "Pen", icon: Pencil, shortcut: "P" },
  { id: "highlighter", label: "Highlighter", icon: Highlighter },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "shape", label: "Shape", icon: Square, shortcut: "S", divider: true },
  { id: "line", label: "Line", icon: Minus, shortcut: "L" },
  { id: "arrow", label: "Arrow", icon: ArrowRight, shortcut: "A" },
  { id: "connector", label: "Connector", icon: Link2 },
  { id: "image", label: "Image", icon: ImageIcon, divider: true },
  { id: "formula", label: "Formula", icon: Sigma },
  { id: "sticky", label: "Sticky note", icon: StickyNote, shortcut: "N" },
  { id: "table", label: "Table", icon: Table2 },
  { id: "frame", label: "Frame", icon: Frame, shortcut: "F" },
];

const COLORS = [
  "#f8fafc",
  "#fbbf24",
  "#fb7185",
  "#38bdf8",
  "#2dd4bf",
  "#4ade80",
  "#a78bfa",
  "#c084fc",
];

const CV_STYLE = `
.cv-root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#f4f4f5;background:#050606;height:calc(100dvh - 4rem);min-height:600px;overflow:hidden;isolation:isolate}
.cv-shell{display:grid;grid-template-rows:64px minmax(0,1fr);height:100%;padding:12px;gap:10px}
.cv-header,.cv-panel,.cv-toolrail,.cv-bottom,.cv-context,.cv-composer{background:rgba(13,15,15,.94);border:1px solid rgba(255,255,255,.09);box-shadow:0 18px 50px rgba(0,0,0,.28)}
.cv-header{display:flex;align-items:center;gap:12px;border-radius:15px;padding:0 14px;min-width:0}
.cv-header-title{min-width:180px;display:flex;align-items:center;gap:9px}
.cv-title-button{font-size:13px;font-weight:650;color:#fafafa;max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv-badge{font-size:10px;color:#5eead4;background:rgba(20,184,166,.12);border:1px solid rgba(45,212,191,.18);padding:4px 8px;border-radius:999px;white-space:nowrap}
.cv-save{font-size:10px;color:#71717a;white-space:nowrap}
.cv-search{margin-left:auto;position:relative;width:min(260px,25vw)}
.cv-search input{width:100%;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:#090b0b;color:#e4e4e7;padding:0 32px 0 34px;font-size:12px;outline:none}
.cv-search svg{position:absolute;left:10px;top:9px;width:15px;height:15px;color:#71717a}
.cv-search kbd{position:absolute;right:8px;top:8px;color:#52525b;font-size:9px}
.cv-head-actions{display:flex;align-items:center;gap:6px}
.cv-icon,.cv-action{display:inline-flex;align-items:center;justify-content:center;height:34px;border:1px solid rgba(255,255,255,.08);background:#0b0d0d;color:#b7b9bd;border-radius:9px;transition:.16s ease}
.cv-icon{width:34px}.cv-action{padding:0 12px;gap:7px;font-size:11px}
.cv-icon:hover,.cv-action:hover{color:white;background:#151818;border-color:rgba(255,255,255,.14)}
.cv-action-primary{color:#99f6e4;background:rgba(13,148,136,.2);border-color:rgba(45,212,191,.34)}
.cv-main{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 258px;gap:10px;min-height:0}
.cv-stage{position:relative;min-width:0;min-height:0;border:1px solid rgba(255,255,255,.09);border-radius:15px;overflow:hidden;background:#080a0a}
.cv-stage svg{display:block;width:100%;height:100%;touch-action:none;user-select:none}
.cv-stage[data-cursor="hand"] svg{cursor:grab}.cv-stage[data-cursor="draw"] svg{cursor:crosshair}.cv-stage[data-cursor="select"] svg{cursor:default}
.cv-grid-dark{fill:#080a0a}.cv-grid-blackboard{fill:#07100e}.cv-grid-whiteboard{fill:#f4f4f0}.cv-grid-paper{fill:#faf7ef}.cv-grid-graph{fill:#f3f7f4}
.cv-toolrail{position:absolute;z-index:30;left:12px;top:50%;transform:translateY(-50%);padding:6px;border-radius:13px;display:flex;flex-direction:column;gap:2px;max-height:calc(100% - 96px);overflow:auto;scrollbar-width:none}
.cv-toolrail::-webkit-scrollbar{display:none}.cv-toolrail>div{flex:0 0 auto}.cv-tool-divider{height:1px;background:rgba(255,255,255,.08);margin:3px 2px}
.cv-tool{position:relative;width:38px;height:38px;display:grid;place-items:center;border-radius:9px;color:#8b9094;transition:.14s}
.cv-tool:hover{background:#171a1a;color:white}.cv-tool[data-active="true"]{background:rgba(20,184,166,.18);color:#5eead4;box-shadow:inset 0 0 0 1px rgba(45,212,191,.2)}
.cv-tool span{position:absolute;left:46px;top:8px;opacity:0;pointer-events:none;background:#111414;border:1px solid rgba(255,255,255,.1);color:#e4e4e7;padding:5px 8px;border-radius:7px;font-size:10px;white-space:nowrap;transition:.12s}
.cv-tool:hover span{opacity:1}.cv-tool span b{color:#5eead4;margin-left:5px}
.cv-bottom{position:absolute;z-index:30;left:14px;bottom:14px;border-radius:12px;padding:6px;display:flex;align-items:center;gap:3px}
.cv-bottom-label{min-width:50px;text-align:center;font:11px ui-monospace,monospace;color:#d4d4d8}
.cv-panel{border-radius:15px;overflow:hidden;display:flex;flex-direction:column;min-height:0}
.cv-inspector-close{display:none}
.cv-panel-tabs{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(255,255,255,.08);padding:6px}
.cv-panel-tab{height:34px;display:grid;place-items:center;color:#71717a;border-radius:8px}
.cv-panel-tab:hover{color:#d4d4d8}.cv-panel-tab[data-active="true"]{color:#5eead4;background:rgba(20,184,166,.12)}
.cv-panel-body{padding:12px;overflow:auto;min-height:0;scrollbar-width:thin;scrollbar-color:#303535 transparent}
.cv-panel-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cv-panel-heading h3{font-size:12px;font-weight:650}.cv-panel-heading p{font-size:9px;color:#62666a}
.cv-page,.cv-layer{display:flex;align-items:center;gap:7px;padding:8px;border-radius:9px;color:#a1a1aa;font-size:11px;margin-bottom:4px;border:1px solid transparent}
.cv-page:hover,.cv-layer:hover{background:rgba(255,255,255,.04);color:#e4e4e7}
.cv-page[data-active="true"],.cv-layer[data-active="true"]{background:rgba(20,184,166,.15);color:#99f6e4;border-color:rgba(45,212,191,.14)}
.cv-page-index{font:10px ui-monospace,monospace;color:#71717a;width:18px}.cv-item-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv-mini-icon{width:25px;height:25px;display:grid;place-items:center;border-radius:7px;color:#71717a}.cv-mini-icon:hover{background:#202323;color:white}
.cv-minimap{margin-top:14px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#080a0a;overflow:hidden}
.cv-minimap svg{display:block;width:100%;height:118px}
.cv-properties-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cv-field{display:flex;flex-direction:column;gap:5px;margin-bottom:9px}
.cv-field label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#6b7073}
.cv-field input,.cv-field textarea,.cv-field select{width:100%;border:1px solid rgba(255,255,255,.09);background:#090b0b;color:#e4e4e7;border-radius:8px;padding:8px;font-size:11px;outline:none}
.cv-field textarea{min-height:90px;resize:vertical}.cv-range{accent-color:#14b8a6}
.cv-color-row{display:flex;gap:5px;flex-wrap:wrap}.cv-swatch{width:23px;height:23px;border-radius:7px;border:1px solid rgba(255,255,255,.16)}.cv-swatch[data-active="true"]{outline:2px solid #5eead4;outline-offset:2px}
.cv-context{position:absolute;z-index:35;border-radius:11px;padding:5px;display:flex;gap:3px;transform:translateY(-100%)}
.cv-context button{width:31px;height:31px;display:grid;place-items:center;border-radius:7px;color:#a1a1aa}.cv-context button:hover{background:#202323;color:white}.cv-context .danger:hover{color:#fda4af}
.cv-selection-outline{fill:none;stroke:#2dd4bf;stroke-width:2;vector-effect:non-scaling-stroke;stroke-dasharray:6 4;pointer-events:none}
.cv-resize-handle{fill:#0f766e;stroke:#ccfbf1;stroke-width:2;vector-effect:non-scaling-stroke;cursor:nwse-resize}
.cv-marquee{fill:rgba(45,212,191,.08);stroke:#2dd4bf;stroke-width:1.5;vector-effect:non-scaling-stroke;stroke-dasharray:5 4}
.cv-object{cursor:move}.cv-object-selected{filter:drop-shadow(0 0 6px rgba(45,212,191,.2))}
.cv-foreign{width:100%;height:100%;overflow:hidden;box-sizing:border-box;color:#f4f4f5}
.cv-foreign-text{padding:8px}.cv-text-content{white-space:pre-wrap;line-height:1.35;width:100%;height:100%;overflow:hidden}
.cv-foreign-sticky{padding:20px}.cv-sticky-content{position:relative;height:100%;white-space:pre-wrap;line-height:1.5;font-size:18px;color:#faf5ff;overflow:hidden}
.cv-sticky-pin{position:absolute;right:0;top:0;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.45);box-shadow:0 0 0 4px rgba(255,255,255,.05)}
.cv-object-formula{height:100%;display:grid;place-items:center;padding:12px;overflow:hidden}.cv-object-formula .katex-display{margin:0}.cv-object-formula .katex{font-size:1.45em}
.cv-object-table{width:100%;height:100%;border-collapse:collapse;font-size:12px}.cv-object-table th,.cv-object-table td{border:1px solid rgba(255,255,255,.13);padding:8px;text-align:left}.cv-object-table th{color:#5eead4;background:rgba(20,184,166,.08)}
.cv-checklist{padding:18px;height:100%;font-size:16px;line-height:1.45}.cv-checklist>div{display:flex;gap:10px;margin-bottom:9px}.cv-checklist span{color:#2dd4bf}.cv-checklist p{margin:0}
.cv-frame-title{font-size:12px;color:#99f6e4;text-transform:uppercase;letter-spacing:.1em;font-weight:650}
.cv-source-card,.cv-flashcard,.cv-question{height:100%;padding:18px;display:flex;flex-direction:column;gap:10px}.cv-source-card>span,.cv-flashcard>span,.cv-question>span{font-size:9px;color:#5eead4;letter-spacing:.12em}.cv-source-card strong,.cv-flashcard strong,.cv-question strong{font-size:17px}.cv-source-card p,.cv-flashcard p,.cv-question p{font-size:12px;line-height:1.5;color:#b8b9bd;white-space:pre-wrap;overflow:hidden}.cv-source-card small{margin-top:auto;color:#5eead4;font-size:10px}
.cv-composer-backdrop{position:absolute;inset:0;z-index:60;background:rgba(0,0,0,.48);display:grid;place-items:center;padding:20px}
.cv-composer{width:min(510px,100%);max-height:min(690px,92%);overflow:auto;border-radius:17px;padding:18px}
.cv-composer-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.cv-composer-head h2{font-size:15px}.cv-composer-preview{min-height:92px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#090b0b;margin:10px 0;padding:12px}
.cv-composer-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.cv-empty{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;text-align:center}.cv-empty h2{font-family:Georgia,serif;font-style:italic;font-size:38px;color:#d4d4d8}.cv-empty p{font-size:12px;color:#62666a;margin-top:6px}
.cv-panel-toggle{display:none;position:absolute;z-index:34;right:12px;top:12px}
.cv-object-count{position:absolute;right:16px;bottom:14px;color:#52575a;font:10px ui-monospace,monospace}
@media(max-width:1100px){.cv-header-title{min-width:140px}.cv-title-button{max-width:170px}.cv-search{display:none}.cv-action span{display:none}.cv-action{width:34px;padding:0}.cv-main{grid-template-columns:minmax(0,1fr) 230px}}
@media(max-width:767px){
 .cv-root{height:calc(100dvh - 11.25rem - env(safe-area-inset-bottom));min-height:520px}.cv-shell{padding:5px;gap:5px;grid-template-rows:54px minmax(0,1fr)}
 .cv-header{border-radius:12px;padding:0 8px;gap:5px}.cv-header-title{min-width:0;flex:1}.cv-title-button{max-width:145px}.cv-badge,.cv-save,.cv-head-actions .cv-hide-mobile{display:none}
 .cv-main{display:block}.cv-stage{height:100%;border-radius:12px}.cv-panel{position:absolute;z-index:50;right:6px;top:6px;bottom:6px;width:min(88vw,320px);box-shadow:-18px 0 50px rgba(0,0,0,.45)}
 .cv-inspector-close{display:grid;place-items:center;position:absolute;z-index:3;right:7px;top:7px;width:32px;height:32px;border-radius:8px;color:#a1a1aa;background:#161919;border:1px solid rgba(255,255,255,.08)}.cv-panel-tabs{padding-right:43px}
 .cv-panel-toggle{display:grid}.cv-toolrail{left:50%;top:auto;bottom:8px;transform:translateX(-50%);flex-direction:row;max-height:none;max-width:calc(100% - 70px);overflow-x:auto;padding:5px}
 .cv-toolrail>div{display:flex;align-items:center}.cv-tool-divider{width:1px;height:28px;margin:5px 3px}.cv-tool span{display:none}.cv-tool{width:40px;height:40px;flex:0 0 auto}
 .cv-bottom{left:8px;bottom:66px}.cv-context{max-width:calc(100% - 20px);overflow:auto}.cv-object-count{display:none}
}
@media(prefers-reduced-motion:reduce){.cv-root *{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
`;

function loadProject(scholarClass: 9 | 11) {
  const raw = profileGetJSON<unknown>(scholarClass, CANVAS_STORAGE_KEY, null);
  return normalizeCanvasProject(raw);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pointDistance(a: CanvasPoint, b: CanvasPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function objectIntersects(
  object: CanvasObject,
  rect: { x: number; y: number; width: number; height: number },
) {
  return !(
    object.x + object.width < rect.x ||
    object.y + object.height < rect.y ||
    object.x > rect.x + rect.width ||
    object.y > rect.y + rect.height
  );
}

function nextZ(objects: CanvasObject[]) {
  return objects.length ? Math.max(...objects.map((object) => object.zIndex)) + 1 : 1;
}

function objectLabel(object: CanvasObject) {
  return object.name || `${object.type[0].toUpperCase()}${object.type.slice(1)}`;
}

export function CanvasView() {
  const scholarClass = useStore((state) => state.user.scholarClass);
  const addXP = useStore((state) => state.addXP);
  const pushActivity = useStore((state) => state.pushActivity);

  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<CanvasProject>(createBlankCanvasProject());
  const interactionRef = useRef<Interaction | null>(null);
  const touchPoints = useRef(new Map<number, CanvasPoint>());
  const clipboardRef = useRef<CanvasObject[]>([]);
  const spaceHeldRef = useRef(false);

  const [project, setProject] = useState<CanvasProject>(() => loadProject(scholarClass));
  const [tool, setTool] = useState<CanvasTool>("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draftObject, setDraftObject] = useState<CanvasObject | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [undoStack, setUndoStack] = useState<CanvasProject[]>([]);
  const [redoStack, setRedoStack] = useState<CanvasProject[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [savedAt, setSavedAt] = useState<number>(() => Date.now());
  const [inspectorPanel, setInspectorPanel] = useState<InspectorPanel>("pages");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSearch, setPageSearch] = useState("");
  const [color, setColor] = useState("#f8fafc");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [viewportLocked, setViewportLocked] = useState(false);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [comments, setComments] = useState<string[]>([]);
  const [commentDraft, setCommentDraft] = useState("");

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    const next = loadProject(scholarClass);
    setProject(next);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedIds([]);
  }, [scholarClass]);

  const activePage = useMemo(
    () => project.pages.find((page) => page.id === project.activePageId) ?? project.pages[0],
    [project],
  );

  const visibleObjects = useMemo(
    () => [...activePage.objects].filter((object) => object.visible).sort((a, b) => a.zIndex - b.zIndex),
    [activePage.objects],
  );

  const selectedObjects = useMemo(
    () => activePage.objects.filter((object) => selectedIds.includes(object.id)),
    [activePage.objects, selectedIds],
  );

  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 767px)");
    const closeInspectorForCompactViewport = (event?: MediaQueryListEvent) => {
      if (event?.matches ?? compactViewport.matches) setInspectorOpen(false);
    };
    closeInspectorForCompactViewport();
    compactViewport.addEventListener("change", closeInspectorForCompactViewport);
    return () => compactViewport.removeEventListener("change", closeInspectorForCompactViewport);
  }, []);

  useEffect(() => {
    const appScroller = document.getElementById("main-scroll");
    if (!appScroller) return;
    const previousOverflowY = appScroller.style.overflowY;
    const previousOverscrollBehavior = appScroller.style.overscrollBehavior;
    const previousBodyOverflow = document.body.style.overflow;
    window.scrollTo({ top: 0, left: 0 });
    appScroller.scrollTo({ top: 0, left: 0 });
    appScroller.style.overflowY = "hidden";
    appScroller.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    return () => {
      appScroller.style.overflowY = previousOverflowY;
      appScroller.style.overscrollBehavior = previousOverscrollBehavior;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  const primarySelection = selectedObjects[0] ?? null;
  const selectionBounds = useMemo(() => objectBounds(selectedObjects), [selectedObjects]);

  useEffect(() => {
    const visibleText = selectedObjects.length
      ? selectedObjects.map((object) => `${objectLabel(object)}: ${object.text ?? ""}`).join("\n").slice(0, 4_000)
      : activePage.objects
          .filter((object) => object.text)
          .slice(0, 12)
          .map((object) => `${objectLabel(object)}: ${object.text}`)
          .join("\n")
          .slice(0, 4_000);
    setLamPageContext({
      subjectTitle: project.subject,
      chapterTitle: activePage.title,
      visibleText,
    });
    return () => setLamPageContext({});
  }, [activePage.id, activePage.objects, activePage.title, project.subject, selectedObjects]);

  useEffect(() => {
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        const next = { ...projectRef.current, updatedAt: new Date().toISOString() };
        profileSetJSON(scholarClass, CANVAS_STORAGE_KEY, next);
        setSavedAt(Date.now());
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [project, scholarClass]);

  const pushHistory = useCallback((snapshot = projectRef.current) => {
    setUndoStack((history) => [...history.slice(-(MAX_HISTORY - 1)), cloneCanvasProject(snapshot)]);
    setRedoStack([]);
  }, []);

  const updateActivePage = useCallback(
    (updater: (page: CanvasPage) => CanvasPage, record = false) => {
      if (record) pushHistory();
      setProject((current) => ({
        ...current,
        pages: current.pages.map((page) =>
          page.id === current.activePageId ? updater(page) : page,
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    setUndoStack((history) => {
      if (!history.length) return history;
      const previous = history[history.length - 1];
      setRedoStack((redo) => [...redo, cloneCanvasProject(projectRef.current)]);
      setProject(cloneCanvasProject(previous));
      setSelectedIds([]);
      return history.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((redo) => {
      if (!redo.length) return redo;
      const next = redo[redo.length - 1];
      setUndoStack((history) => [...history, cloneCanvasProject(projectRef.current)]);
      setProject(cloneCanvasProject(next));
      setSelectedIds([]);
      return redo.slice(0, -1);
    });
  }, []);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): CanvasPoint => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const viewport = projectRef.current.pages.find(
        (page) => page.id === projectRef.current.activePageId,
      )?.viewport ?? { x: 0, y: 0, zoom: 1 };
      return {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [],
  );

  const worldCenter = useCallback((): CanvasPoint => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 300, y: 200 };
    return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [screenToWorld]);

  const addObject = useCallback(
    (object: CanvasObject) => {
      updateActivePage(
        (page) => ({
          ...page,
          objects: [...page.objects, { ...object, zIndex: nextZ(page.objects) }],
        }),
        true,
      );
      setSelectedIds([object.id]);
      setTool("select");
      addXP(1);
    },
    [addXP, updateActivePage],
  );

  const updateSelected = useCallback(
    (changes: Partial<CanvasObject>, record = true) => {
      if (!selectedIds.length) return;
      updateActivePage(
        (page) => ({
          ...page,
          objects: page.objects.map((object) =>
            selectedIds.includes(object.id) ? { ...object, ...changes } : object,
          ),
        }),
        record,
      );
    },
    [selectedIds, updateActivePage],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) return;
    updateActivePage(
      (page) => ({
        ...page,
        objects: page.objects.filter((object) => !selectedIds.includes(object.id)),
      }),
      true,
    );
    setSelectedIds([]);
    toast.success("Selection deleted");
  }, [selectedIds, updateActivePage]);

  const duplicateSelected = useCallback(() => {
    if (!selectedObjects.length) return;
    const copies = selectedObjects.map((object, index) => ({
      ...object,
      id: canvasId(object.type),
      name: `${object.name} copy`,
      x: object.x + 28,
      y: object.y + 28,
      zIndex: nextZ(activePage.objects) + index,
      groupId: undefined,
    }));
    updateActivePage(
      (page) => ({ ...page, objects: [...page.objects, ...copies] }),
      true,
    );
    setSelectedIds(copies.map((object) => object.id));
  }, [activePage.objects, selectedObjects, updateActivePage]);

  const groupSelected = useCallback(() => {
    if (selectedIds.length < 2) return;
    const groupId = canvasId("group");
    updateSelected({ groupId }, true);
    toast.success("Objects grouped");
  }, [selectedIds.length, updateSelected]);

  const ungroupSelected = useCallback(() => {
    updateSelected({ groupId: undefined }, true);
    toast.success("Objects ungrouped");
  }, [updateSelected]);

  const setLayerOrder = useCallback(
    (direction: "front" | "back" | "up" | "down", ids = selectedIds) => {
      if (!ids.length) return;
      updateActivePage(
        (page) => {
          const ordered = [...page.objects].sort((a, b) => a.zIndex - b.zIndex);
          if (direction === "front" || direction === "back") {
            const anchor = direction === "front" ? nextZ(ordered) : Math.min(...ordered.map((object) => object.zIndex), 0) - ids.length;
            return {
              ...page,
              objects: page.objects.map((object, index) =>
                ids.includes(object.id)
                  ? { ...object, zIndex: anchor + index }
                  : object,
              ),
            };
          }
          const selected = ordered.findIndex((object) => ids.includes(object.id));
          const target = direction === "up" ? selected + 1 : selected - 1;
          if (selected < 0 || target < 0 || target >= ordered.length) return page;
          [ordered[selected], ordered[target]] = [ordered[target], ordered[selected]];
          return {
            ...page,
            objects: ordered.map((object, index) => ({ ...object, zIndex: index + 1 })),
          };
        },
        true,
      );
    },
    [selectedIds, updateActivePage],
  );

  const fitObjects = useCallback(
    (objects = activePage.objects.filter((object) => object.visible)) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || !objects.length || viewportLocked) return;
      const bounds = objectBounds(objects);
      const padding = 110;
      const zoom = clamp(
        Math.min((rect.width - padding * 2) / bounds.width, (rect.height - padding * 2) / bounds.height),
        0.1,
        4,
      );
      updateActivePage((page) => ({
        ...page,
        viewport: {
          zoom,
          x: rect.width / 2 - (bounds.x + bounds.width / 2) * zoom,
          y: rect.height / 2 - (bounds.y + bounds.height / 2) * zoom,
        },
      }));
    },
    [activePage.objects, updateActivePage, viewportLocked],
  );

  const setZoom = useCallback(
    (zoom: number) => {
      if (viewportLocked) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const current = activePage.viewport;
      const nextZoom = clamp(zoom, 0.1, 4);
      const center = { x: rect.width / 2, y: rect.height / 2 };
      const world = {
        x: (center.x - current.x) / current.zoom,
        y: (center.y - current.y) / current.zoom,
      };
      updateActivePage((page) => ({
        ...page,
        viewport: {
          zoom: nextZoom,
          x: center.x - world.x * nextZoom,
          y: center.y - world.y * nextZoom,
        },
      }));
    },
    [activePage.viewport, updateActivePage, viewportLocked],
  );

  const normalizeDraftDrawing = useCallback((object: CanvasObject) => {
    const points = object.points ?? [];
    if (!points.length) return object;
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxX = Math.max(...points.map((point) => point.x));
    const maxY = Math.max(...points.map((point) => point.y));
    return {
      ...object,
      x: object.x + minX,
      y: object.y + minY,
      width: Math.max(10, maxX - minX),
      height: Math.max(10, maxY - minY),
      points: points.map((point) => ({ x: point.x - minX, y: point.y - minY })),
    };
  }, []);

  const openComposer = useCallback(
    (type: CanvasObjectType, at: CanvasPoint, object?: CanvasObject) => {
      const defaults: Partial<Record<CanvasObjectType, string>> = {
        text: "Add a heading or explanation",
        sticky: "Write a quick study note…",
        formula: String.raw`E_n=-\frac{13.6Z^2}{n^2}\,\mathrm{eV}`,
        table: "Concept | Meaning | Example\nTerm 1 | Definition | Application\nTerm 2 | Definition | Application",
        checklist: "Review definitions\nPractise examples\nCheck mistakes",
        source: "Paste or describe the Scholar content you want to place on this Canvas.",
        flashcard: "Front: Key concept\nBack: Explanation",
        question: "Question\n\nMethod and final answer",
      };
      setComposer({
        type,
        at,
        editId: object?.id,
        name: object?.name || type[0].toUpperCase() + type.slice(1),
        text: object?.text || defaults[type] || "",
        sourceLabel: object?.sourceLabel || (type === "source" ? "Scholar source" : undefined),
        sourceView: object?.sourceView || (type === "source" ? "ebook" : undefined),
      });
    },
    [],
  );

  const applyComposer = useCallback(() => {
    if (!composer || !composer.text.trim()) return;
    if (composer.editId) {
      updateActivePage(
        (page) => ({
          ...page,
          objects: page.objects.map((object) =>
            object.id === composer.editId
              ? {
                  ...object,
                  name: composer.name.trim() || object.name,
                  text: composer.text.trim(),
                  sourceLabel: composer.sourceLabel,
                  sourceView: composer.sourceView,
                }
              : object,
          ),
        }),
        true,
      );
    } else {
      addObject(
        createCanvasObject(composer.type, composer.at, {
          name: composer.name.trim() || `New ${composer.type}`,
          text: composer.text.trim(),
          color,
          sourceLabel: composer.sourceLabel,
          sourceView: composer.sourceView,
          handwritten: composer.type === "sticky",
        }),
      );
    }
    setComposer(null);
  }, [addObject, color, composer, updateActivePage]);

  const onObjectPointerDown = useCallback(
    (event: ReactPointerEvent<SVGGElement>, object: CanvasObject) => {
      event.stopPropagation();
      if (tool === "eraser") {
        updateActivePage(
          (page) => ({ ...page, objects: page.objects.filter((item) => item.id !== object.id) }),
          true,
        );
        return;
      }
      if (["line", "arrow", "connector"].includes(tool)) {
        const start = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
        const draft = createCanvasObject("line", start, {
          name: tool === "connector" ? "Connector" : tool === "arrow" ? "Arrow" : "Line",
          width: 1,
          height: 1,
          color,
          strokeWidth,
          arrowEnd: tool !== "line",
          lineStyle: tool === "connector" ? "curved" : "solid",
          fromId: object.id,
        });
        setDraftObject(draft);
        interactionRef.current = {
          kind: "draw",
          snapshot: cloneCanvasProject(projectRef.current),
          startWorld: start,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      if (tool !== "select") return;
      const groupIds = object.groupId
        ? activePage.objects.filter((item) => item.groupId === object.groupId).map((item) => item.id)
        : [object.id];
      const nextSelection = event.shiftKey
        ? Array.from(new Set([...selectedIds, ...groupIds]))
        : selectedIds.includes(object.id)
          ? selectedIds
          : groupIds;
      setSelectedIds(nextSelection);
      const originals = activePage.objects
        .filter((item) => nextSelection.includes(item.id))
        .map((item) => ({ ...item, points: item.points?.map((point) => ({ ...point })) }));
      if (!object.locked) {
        interactionRef.current = {
          kind: "drag",
          startClient: { x: event.clientX, y: event.clientY },
          originals,
          snapshot: cloneCanvasProject(projectRef.current),
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [activePage.objects, color, selectedIds, strokeWidth, tool, updateActivePage],
  );

  const beginResize = useCallback(
    (event: ReactPointerEvent<SVGCircleElement>, object: CanvasObject) => {
      event.stopPropagation();
      if (object.locked) return;
      interactionRef.current = {
        kind: "resize",
        startClient: { x: event.clientX, y: event.clientY },
        object: { ...object, points: object.points?.map((point) => ({ ...point })) },
        snapshot: cloneCanvasProject(projectRef.current),
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const onSurfacePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchPoints.current.size === 2 && !viewportLocked) {
        const [first, second] = Array.from(touchPoints.current.values());
        interactionRef.current = {
          kind: "pinch",
          distance: pointDistance(first, second),
          center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
          viewport: { ...activePage.viewport },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      if (
        event.button === 1 ||
        tool === "hand" ||
        spaceHeldRef.current
      ) {
        if (viewportLocked) return;
        interactionRef.current = {
          kind: "pan",
          startClient: { x: event.clientX, y: event.clientY },
          viewport: { ...activePage.viewport },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const point = screenToWorld(event.clientX, event.clientY);
      if (tool === "select" || tool === "eraser") {
        if (!event.shiftKey) setSelectedIds([]);
        interactionRef.current = { kind: "marquee", startWorld: point };
        setMarquee({ x: point.x, y: point.y, width: 0, height: 0 });
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      if (["text", "sticky", "formula", "table", "checklist", "source"].includes(tool)) {
        const type = tool === "source" ? "source" : (tool as CanvasObjectType);
        openComposer(type, point);
        return;
      }
      if (tool === "image") {
        fileInputRef.current?.click();
        return;
      }
      if (["pen", "highlighter", "shape", "line", "arrow", "connector", "frame"].includes(tool)) {
        const type: CanvasObjectType =
          tool === "pen" || tool === "highlighter" ? "drawing"
            : tool === "shape" ? "shape"
              : tool === "frame" ? "frame"
                : "line";
        const object = createCanvasObject(type, point, {
          name: tool === "highlighter" ? "Highlight" : tool[0].toUpperCase() + tool.slice(1),
          width: 1,
          height: 1,
          color: tool === "highlighter" ? "#fbbf24" : color,
          opacity: tool === "highlighter" ? 0.42 : 1,
          strokeWidth: tool === "highlighter" ? Math.max(10, strokeWidth * 4) : strokeWidth,
          shape: type === "shape" ? "rounded" : undefined,
          fill: type === "shape" ? "rgba(45,212,191,.06)" : undefined,
          arrowEnd: tool === "arrow" || tool === "connector",
          lineStyle: tool === "connector" ? "curved" : "solid",
          points: type === "drawing" ? [{ x: 0, y: 0 }] : undefined,
        });
        setDraftObject(object);
        interactionRef.current = {
          kind: "draw",
          snapshot: cloneCanvasProject(projectRef.current),
          startWorld: point,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [
      activePage.viewport,
      color,
      openComposer,
      screenToWorld,
      strokeWidth,
      tool,
      viewportLocked,
    ],
  );

  const onSurfacePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (touchPoints.current.has(event.pointerId)) {
        touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (interaction.kind === "pinch") {
        const points = Array.from(touchPoints.current.values());
        if (points.length < 2) return;
        const distance = pointDistance(points[0], points[1]);
        const center = {
          x: (points[0].x + points[1].x) / 2,
          y: (points[0].y + points[1].y) / 2,
        };
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const zoom = clamp(interaction.viewport.zoom * (distance / interaction.distance), 0.1, 4);
        const localStart = {
          x: interaction.center.x - rect.left,
          y: interaction.center.y - rect.top,
        };
        const world = {
          x: (localStart.x - interaction.viewport.x) / interaction.viewport.zoom,
          y: (localStart.y - interaction.viewport.y) / interaction.viewport.zoom,
        };
        const localCenter = { x: center.x - rect.left, y: center.y - rect.top };
        updateActivePage((page) => ({
          ...page,
          viewport: {
            zoom,
            x: localCenter.x - world.x * zoom,
            y: localCenter.y - world.y * zoom,
          },
        }));
        return;
      }
      if (interaction.kind === "pan") {
        updateActivePage((page) => ({
          ...page,
          viewport: {
            ...page.viewport,
            x: interaction.viewport.x + event.clientX - interaction.startClient.x,
            y: interaction.viewport.y + event.clientY - interaction.startClient.y,
          },
        }));
        return;
      }
      if (interaction.kind === "drag") {
        const zoom = activePage.viewport.zoom;
        let dx = (event.clientX - interaction.startClient.x) / zoom;
        let dy = (event.clientY - interaction.startClient.y) / zoom;
        if (!event.altKey) {
          dx = Math.round(dx / GRID_SIZE) * GRID_SIZE;
          dy = Math.round(dy / GRID_SIZE) * GRID_SIZE;
        }
        interaction.moved = Math.abs(dx) > 0 || Math.abs(dy) > 0;
        const originals = new Map(interaction.originals.map((object) => [object.id, object]));
        updateActivePage((page) => ({
          ...page,
          objects: page.objects.map((object) => {
            const original = originals.get(object.id);
            return original ? { ...object, x: original.x + dx, y: original.y + dy } : object;
          }),
        }));
        return;
      }
      if (interaction.kind === "resize") {
        const zoom = activePage.viewport.zoom;
        const dx = (event.clientX - interaction.startClient.x) / zoom;
        const dy = (event.clientY - interaction.startClient.y) / zoom;
        interaction.moved = Math.abs(dx) > 1 || Math.abs(dy) > 1;
        updateActivePage((page) => ({
          ...page,
          objects: page.objects.map((object) =>
            object.id === interaction.object.id
              ? {
                  ...object,
                  width: Math.max(28, interaction.object.width + dx),
                  height: Math.max(28, interaction.object.height + dy),
                }
              : object,
          ),
        }));
        return;
      }
      const point = screenToWorld(event.clientX, event.clientY);
      if (interaction.kind === "marquee") {
        setMarquee({
          x: Math.min(interaction.startWorld.x, point.x),
          y: Math.min(interaction.startWorld.y, point.y),
          width: Math.abs(point.x - interaction.startWorld.x),
          height: Math.abs(point.y - interaction.startWorld.y),
        });
        return;
      }
      if (interaction.kind === "draw" && draftObject) {
        if (draftObject.type === "drawing") {
          setDraftObject((current) =>
            current
              ? {
                  ...current,
                  points: [
                    ...(current.points ?? []),
                    {
                      x: point.x - interaction.startWorld.x,
                      y: point.y - interaction.startWorld.y,
                    },
                  ],
                }
              : null,
          );
        } else {
          setDraftObject((current) =>
            current
              ? {
                  ...current,
                  x: Math.min(interaction.startWorld.x, point.x),
                  y: Math.min(interaction.startWorld.y, point.y),
                  width: Math.max(2, Math.abs(point.x - interaction.startWorld.x)),
                  height: Math.max(2, Math.abs(point.y - interaction.startWorld.y)),
                }
              : null,
          );
        }
      }
    },
    [activePage.viewport.zoom, draftObject, screenToWorld, updateActivePage],
  );

  const endInteraction = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      touchPoints.current.delete(event.pointerId);
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (interaction.kind === "pinch" && touchPoints.current.size >= 2) return;
      if ((interaction.kind === "drag" || interaction.kind === "resize") && interaction.moved) {
        pushHistory(interaction.snapshot);
      }
      if (interaction.kind === "marquee" && marquee) {
        const matches = activePage.objects
          .filter((object) => object.visible && objectIntersects(object, marquee))
          .map((object) => object.id);
        setSelectedIds((current) => event.shiftKey ? Array.from(new Set([...current, ...matches])) : matches);
      }
      if (interaction.kind === "draw" && draftObject) {
        const object = draftObject.type === "drawing"
          ? normalizeDraftDrawing(draftObject)
          : draftObject;
        if (object.width > 4 && object.height > 4) {
          pushHistory(interaction.snapshot);
          setProject((current) => ({
            ...current,
            pages: current.pages.map((page) =>
              page.id === current.activePageId
                ? {
                    ...page,
                    objects: [...page.objects, { ...object, zIndex: nextZ(page.objects) }],
                  }
                : page,
            ),
          }));
          setSelectedIds([object.id]);
          if (!["pen", "highlighter"].includes(tool)) setTool("select");
        }
      }
      setDraftObject(null);
      setMarquee(null);
      interactionRef.current = null;
    },
    [
      activePage.objects,
      draftObject,
      marquee,
      normalizeDraftDrawing,
      pushHistory,
      tool,
    ],
  );

  const onWheel = useCallback(
    (event: ReactWheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      if (viewportLocked) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const horizontalGesture = Math.abs(event.deltaX) > 0.5 || event.shiftKey;
      if (horizontalGesture && !event.ctrlKey && !event.metaKey) {
        updateActivePage((page) => ({
          ...page,
          viewport: {
            ...page.viewport,
            x: page.viewport.x - event.deltaX - (event.shiftKey ? event.deltaY : 0),
            y: page.viewport.y - (event.shiftKey ? 0 : event.deltaY),
          },
        }));
        return;
      }
      const current = activePage.viewport;
      const zoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.0014), 0.1, 4);
      const local = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const world = {
        x: (local.x - current.x) / current.zoom,
        y: (local.y - current.y) / current.zoom,
      };
      updateActivePage((page) => ({
        ...page,
        viewport: {
          zoom,
          x: local.x - world.x * zoom,
          y: local.y - world.y * zoom,
        },
      }));
    },
    [activePage.viewport, updateActivePage, viewportLocked],
  );

  const onImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Choose a JPG, PNG, WEBP, GIF, or another image file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxWidth = 520;
          const ratio = Math.min(1, maxWidth / image.naturalWidth);
          addObject(
            createCanvasObject("image", worldCenter(), {
              name: file.name,
              imageUrl: String(reader.result),
              width: Math.max(120, image.naturalWidth * ratio),
              height: Math.max(80, image.naturalHeight * ratio),
            }),
          );
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [addObject, worldCenter],
  );

  const addPage = useCallback(() => {
    pushHistory();
    const page = createBlankPage(`Page ${projectRef.current.pages.length + 1}`);
    setProject((current) => ({
      ...current,
      pages: [...current.pages, page],
      activePageId: page.id,
    }));
    setSelectedIds([]);
  }, [pushHistory]);

  const duplicatePage = useCallback((pageId: string) => {
    const source = projectRef.current.pages.find((page) => page.id === pageId);
    if (!source) return;
    pushHistory();
    const copy: CanvasPage = {
      ...JSON.parse(JSON.stringify(source)),
      id: canvasId("page"),
      title: `${source.title} copy`,
      objects: source.objects.map((object) => ({ ...object, id: canvasId(object.type) })),
    };
    setProject((current) => ({
      ...current,
      pages: [...current.pages, copy],
      activePageId: copy.id,
    }));
  }, [pushHistory]);

  const deletePage = useCallback((pageId: string) => {
    if (projectRef.current.pages.length === 1) {
      toast.error("A Canvas project needs at least one page.");
      return;
    }
    pushHistory();
    setProject((current) => {
      const pages = current.pages.filter((page) => page.id !== pageId);
      return {
        ...current,
        pages,
        activePageId: current.activePageId === pageId ? pages[0].id : current.activePageId,
      };
    });
    setSelectedIds([]);
  }, [pushHistory]);

  const movePage = useCallback((pageId: string, direction: -1 | 1) => {
    const index = projectRef.current.pages.findIndex((page) => page.id === pageId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= projectRef.current.pages.length) return;
    pushHistory();
    setProject((current) => {
      const pages = [...current.pages];
      [pages[index], pages[target]] = [pages[target], pages[index]];
      return { ...current, pages };
    });
  }, [pushHistory]);

  const applyTemplate = useCallback(
    (template: "chemistry" | "mindmap" | "formula" | "revision") => {
      const center = worldCenter();
      let objects: CanvasObject[];
      if (template === "chemistry") {
        objects = chemistryReactionTemplate();
      } else if (template === "mindmap") {
        const root = createCanvasObject("shape", { x: center.x - 110, y: center.y - 60 }, {
          name: "Central concept", shape: "ellipse", text: "Central concept", width: 220, height: 120,
        });
        const branches = [-1, 1].flatMap((xDirection) => [-1, 1].map((yDirection, index) =>
          createCanvasObject("sticky", {
            x: center.x + xDirection * 320 - 110,
            y: center.y + yDirection * 190 - 70,
          }, {
            name: `Branch ${xDirection === -1 ? index + 1 : index + 3}`,
            text: "Add a connected idea",
            width: 220,
            height: 140,
            fill: xDirection === -1 ? "#164e63" : "#3b2560",
          }),
        ));
        objects = [root, ...branches];
      } else if (template === "formula") {
        objects = [
          createCanvasObject("frame", { x: center.x - 480, y: center.y - 300 }, {
            name: "Formula sheet", text: "Formula Sheet", width: 960, height: 600,
          }),
          createCanvasObject("formula", { x: center.x - 390, y: center.y - 170 }, {
            name: "Core formula", text: String.raw`v^2=u^2+2as`, width: 360, height: 120,
          }),
          createCanvasObject("formula", { x: center.x + 40, y: center.y - 170 }, {
            name: "Energy formula", text: String.raw`E=\frac{1}{2}mv^2`, width: 360, height: 120,
          }),
          createCanvasObject("sticky", { x: center.x - 170, y: center.y + 40 }, {
            name: "Usage notes", text: "Write units, assumptions, and common mistakes here.", width: 340, height: 180,
          }),
        ];
      } else {
        objects = [
          createCanvasObject("frame", { x: center.x - 450, y: center.y - 280 }, {
            name: "Exam revision", text: "Exam Revision Board", width: 900, height: 560,
          }),
          createCanvasObject("checklist", { x: center.x - 390, y: center.y - 180 }, {
            name: "Revision checklist", width: 350, height: 300,
          }),
          createCanvasObject("question", { x: center.x + 30, y: center.y - 180 }, {
            name: "Practice question", width: 350, height: 230,
          }),
        ];
      }
      const stageRect = svgRef.current?.getBoundingClientRect();
      const bounds = objectBounds(objects);
      const fittedViewport = stageRect
        ? (() => {
            const padding = stageRect.width < 700 ? 54 : 86;
            const zoom = clamp(
              Math.min(
                (stageRect.width - padding * 2) / Math.max(bounds.width, 1),
                (stageRect.height - padding * 2) / Math.max(bounds.height, 1),
              ),
              0.1,
              4,
            );
            return {
              zoom,
              x: stageRect.width / 2 - (bounds.x + bounds.width / 2) * zoom,
              y: stageRect.height / 2 - (bounds.y + bounds.height / 2) * zoom,
            };
          })()
        : { x: 70, y: 45, zoom: 0.78 };
      pushHistory();
      updateActivePage((page) => ({
        ...page,
        title: template === "chemistry" ? "Nucleophilic Substitution" : page.title,
        objects: objects.map((object, index) => ({ ...object, zIndex: index + 1 })),
        viewport: fittedViewport,
      }));
      setSelectedIds([]);
      toast.success("Editable Canvas template added");
    },
    [pushHistory, updateActivePage, worldCenter],
  );

  const askLam = useCallback(() => {
    const context = selectedObjects.length
      ? selectedObjects.map((object) => `${objectLabel(object)}: ${object.text ?? ""}`).join("\n")
      : activePage.objects.filter((object) => object.text).map((object) => object.text).join("\n").slice(0, 4_000);
    const prompt = selectedObjects.length
      ? `Help me study the selected Canvas content:\n\n${context}`
      : `Review my Canvas page "${activePage.title}". What is missing or could be organised better?\n\n${context}`;
    setLamDraft({ prompt });
    window.dispatchEvent(new CustomEvent("scholar:open-lam", {
      detail: {
        prompt,
        context: {
          subjectTitle: project.subject,
          chapterTitle: activePage.title,
          visibleText: context,
        },
      },
    }));
  }, [activePage.objects, activePage.title, project.subject, selectedObjects]);

  const copyShareLink = useCallback(async () => {
    const url = `${window.location.origin}/canvas?project=${encodeURIComponent(project.id)}&page=${encodeURIComponent(activePage.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Canvas link copied", {
        description: "This local Canvas remains private unless you also export and share the project file.",
      });
    } catch {
      toast.error("Copy failed. Use Export project instead.");
    }
  }, [activePage.id, project.id]);

  const saveNow = useCallback(() => {
    try {
      profileSetJSON(scholarClass, CANVAS_STORAGE_KEY, {
        ...projectRef.current,
        updatedAt: new Date().toISOString(),
      });
      setSavedAt(Date.now());
      setSaveStatus("saved");
      toast.success("Canvas saved");
      pushActivity({ type: "canvas", icon: "🧩", text: `Saved Canvas "${projectRef.current.title}"` });
    } catch {
      setSaveStatus("error");
      toast.error("Canvas could not be saved");
    }
  }, [pushActivity, scholarClass]);

  const exportProject = useCallback(() => {
    const blob = new Blob([JSON.stringify(projectRef.current, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.title.replace(/\W+/g, "-").toLowerCase() || "scholar-canvas"}.scholar-canvas.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success("Editable Canvas project exported");
  }, [project.title]);

  const makePng = useCallback(async (): Promise<Blob | null> => {
    const svg = svgRef.current;
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll(".cv-selection-outline,.cv-resize-handle,.cv-marquee").forEach((node) => node.remove());
    clone.querySelector<SVGGElement>('[data-canvas-world="true"]')?.removeAttribute("transform");
    const bounds = objectBounds(activePage.objects.filter((object) => object.visible));
    const padding = 60;
    clone.setAttribute("viewBox", `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`);
    clone.setAttribute("width", String(Math.min(4096, Math.max(1200, bounds.width + padding * 2))));
    clone.setAttribute("height", String(Math.min(4096, Math.max(800, bounds.height + padding * 2))));
    const serialized = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Canvas rendering failed"));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(4096, Math.max(1200, Math.round(bounds.width + padding * 2)));
      canvas.height = Math.min(4096, Math.max(800, Math.round(bounds.height + padding * 2)));
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.fillStyle = "#080a0a";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [activePage.objects]);

  const exportPng = useCallback(async () => {
    try {
      const blob = await makePng();
      if (!blob) throw new Error("No image");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${activePage.title.replace(/\W+/g, "-").toLowerCase() || "canvas-page"}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success("Canvas page exported as PNG");
      addXP(1);
    } catch {
      toast.error("This page could not be exported. Check external image sources.");
    }
  }, [activePage.title, addXP, makePng]);

  const printPdf = useCallback(async () => {
    const blob = await makePng();
    if (!blob) {
      toast.error("PDF export could not render this page.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      URL.revokeObjectURL(url);
      toast.error("Allow popups to use Save as PDF.");
      return;
    }
    popup.document.write(`<title>${activePage.title}</title><style>@page{size:landscape;margin:0}body{margin:0;background:#080a0a;display:grid;place-items:center;min-height:100vh}img{max-width:100vw;max-height:100vh}</style><img src="${url}" alt="">`);
    popup.document.close();
    popup.addEventListener("load", () => {
      popup.focus();
      popup.print();
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
    });
  }, [activePage.title, makePng]);

  const openSource = useCallback((object: CanvasObject) => {
    if (!object.sourceView) return;
    navigateTo(object.sourceView, object.sourceId ? { sourceId: object.sourceId } : undefined);
  }, []);

  const focusObject = useCallback(
    (object: CanvasObject) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const zoom = clamp(activePage.viewport.zoom, 0.4, 2);
      updateActivePage((page) => ({
        ...page,
        viewport: {
          zoom,
          x: rect.width / 2 - (object.x + object.width / 2) * zoom,
          y: rect.height / 2 - (object.y + object.height / 2) * zoom,
        },
      }));
      setSelectedIds([object.id]);
      setSearch("");
    },
    [activePage.viewport.zoom, updateActivePage],
  );

  const filteredSearchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return project.pages.flatMap((page) =>
      page.objects
        .filter((object) =>
          [object.name, object.text, object.sourceLabel].filter(Boolean).join(" ").toLowerCase().includes(query),
        )
        .map((object) => ({ page, object })),
    ).slice(0, 12);
  }, [project.pages, search]);

  const changeProjectTitle = useCallback(() => {
    const title = window.prompt("Canvas project name:", projectRef.current.title)?.trim();
    if (!title || title === projectRef.current.title) return;
    pushHistory();
    setProject((current) => ({ ...current, title }));
  }, [pushHistory]);

  const changeSubject = useCallback(() => {
    const subject = window.prompt("Subject or category:", projectRef.current.subject)?.trim();
    if (!subject || subject === projectRef.current.subject) return;
    pushHistory();
    setProject((current) => ({ ...current, subject }));
  }, [pushHistory]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.matches("input,textarea,select,[contenteditable=true]");
      if (event.code === "Space" && !editing) {
        spaceHeldRef.current = true;
        event.preventDefault();
        return;
      }
      if (editing) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (modifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (modifier && key === "y") {
        event.preventDefault();
        redo();
      } else if (modifier && key === "s") {
        event.preventDefault();
        saveNow();
      } else if (modifier && key === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (modifier && key === "c") {
        clipboardRef.current = selectedObjects.map((object) => ({ ...object }));
      } else if (modifier && key === "v" && clipboardRef.current.length) {
        event.preventDefault();
        const copies = clipboardRef.current.map((object, index) => ({
          ...object,
          id: canvasId(object.type),
          x: object.x + 24,
          y: object.y + 24,
          zIndex: nextZ(activePage.objects) + index,
        }));
        updateActivePage((page) => ({ ...page, objects: [...page.objects, ...copies] }), true);
        setSelectedIds(copies.map((object) => object.id));
      } else if (modifier && key === "g") {
        event.preventDefault();
        if (event.shiftKey) ungroupSelected();
        else groupSelected();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      } else if (event.key === "Escape") {
        setComposer(null);
        setSelectedIds([]);
        setTool("select");
      } else if (event.key === "0") {
        fitObjects();
      } else if (event.key === "1") {
        setZoom(1);
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selectedIds.length) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const delta = {
          x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
          y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
        };
        updateActivePage((page) => ({
          ...page,
          objects: page.objects.map((object) =>
            selectedIds.includes(object.id)
              ? { ...object, x: object.x + delta.x, y: object.y + delta.y }
              : object,
          ),
        }), true);
      } else if (!modifier) {
        const shortcuts: Record<string, CanvasTool> = {
          v: "select", h: "hand", t: "text", p: "pen", s: "shape",
          l: "line", a: "arrow", n: "sticky", f: "frame",
        };
        if (shortcuts[key]) setTool(shortcuts[key]);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceHeldRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    activePage.objects,
    deleteSelected,
    duplicateSelected,
    fitObjects,
    groupSelected,
    redo,
    saveNow,
    selectedIds,
    selectedObjects,
    setZoom,
    undo,
    ungroupSelected,
    updateActivePage,
  ]);

  const stageCursor = tool === "hand" ? "hand" : ["pen", "highlighter", "shape", "line", "arrow", "connector", "frame"].includes(tool) ? "draw" : "select";
  const worldTransform = `translate(${activePage.viewport.x} ${activePage.viewport.y}) scale(${activePage.viewport.zoom})`;
  const contextLeft = clamp(activePage.viewport.x + selectionBounds.x * activePage.viewport.zoom, 58, Math.max(58, (stageRef.current?.clientWidth ?? 800) - 280));
  const contextTop = clamp(activePage.viewport.y + selectionBounds.y * activePage.viewport.zoom - 8, 54, (stageRef.current?.clientHeight ?? 600) - 40);

  const renderInspector = () => {
    if (inspectorPanel === "pages") {
      const pages = project.pages.filter((page) => page.title.toLowerCase().includes(pageSearch.toLowerCase()));
      return (
        <>
          <div className="cv-panel-heading">
            <div><h3>Pages</h3><p>{project.pages.length} boards in this project</p></div>
            <button className="cv-mini-icon" onClick={addPage} aria-label="Add page"><Plus size={15} /></button>
          </div>
          <div className="cv-field">
            <input value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} placeholder="Search pages…" aria-label="Search pages" />
          </div>
          {pages.map((page, index) => (
            <div
              key={page.id}
              className="cv-page"
              data-active={page.id === activePage.id}
              onClick={() => {
                setProject((current) => ({ ...current, activePageId: page.id }));
                setSelectedIds([]);
              }}
            >
              <span className="cv-page-index">{index + 1}</span>
              <span className="cv-item-name">{page.title}</span>
              <button className="cv-mini-icon" onClick={(event) => { event.stopPropagation(); movePage(page.id, -1); }} aria-label={`Move ${page.title} up`}><ArrowUp size={12} /></button>
              <button className="cv-mini-icon" onClick={(event) => { event.stopPropagation(); duplicatePage(page.id); }} aria-label={`Duplicate ${page.title}`}><Copy size={12} /></button>
              <button className="cv-mini-icon" onClick={(event) => { event.stopPropagation(); deletePage(page.id); }} aria-label={`Delete ${page.title}`}><Trash2 size={12} /></button>
            </div>
          ))}
          <button className="cv-action w-full mt-2" onClick={addPage}><Plus size={14} /> Add page</button>
          <Minimap page={activePage} onNavigate={(point) => {
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            updateActivePage((page) => ({
              ...page,
              viewport: {
                ...page.viewport,
                x: rect.width / 2 - point.x * page.viewport.zoom,
                y: rect.height / 2 - point.y * page.viewport.zoom,
              },
            }));
          }} />
        </>
      );
    }
    if (inspectorPanel === "layers") {
      const objects = [...activePage.objects].sort((a, b) => b.zIndex - a.zIndex);
      return (
        <>
          <div className="cv-panel-heading">
            <div><h3>Layers</h3><p>{objects.length} objects on this page</p></div>
            <Layers size={15} className="text-zinc-500" />
          </div>
          {objects.map((object) => (
            <div
              key={object.id}
              className="cv-layer"
              data-active={selectedIds.includes(object.id)}
              onClick={() => setSelectedIds([object.id])}
              onDoubleClick={() => {
                const name = window.prompt("Layer name:", object.name)?.trim();
                if (name) {
                  setSelectedIds([object.id]);
                  updateActivePage((page) => ({
                    ...page,
                    objects: page.objects.map((item) => item.id === object.id ? { ...item, name } : item),
                  }), true);
                }
              }}
            >
              <button className="cv-mini-icon" onClick={(event) => {
                event.stopPropagation();
                updateActivePage((page) => ({
                  ...page,
                  objects: page.objects.map((item) => item.id === object.id ? { ...item, visible: !item.visible } : item),
                }), true);
              }} aria-label={object.visible ? `Hide ${object.name}` : `Show ${object.name}`}>
                {object.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <span className="cv-item-name">{objectLabel(object)}</span>
              <button className="cv-mini-icon" onClick={(event) => {
                event.stopPropagation();
                setSelectedIds([object.id]);
                updateActivePage((page) => ({
                  ...page,
                  objects: page.objects.map((item) => item.id === object.id ? { ...item, locked: !item.locked } : item),
                }), true);
              }} aria-label={object.locked ? `Unlock ${object.name}` : `Lock ${object.name}`}>
                {object.locked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
              <button className="cv-mini-icon" onClick={(event) => { event.stopPropagation(); setLayerOrder("up", [object.id]); }} aria-label={`Bring ${object.name} forward`}><ArrowUp size={12} /></button>
            </div>
          ))}
        </>
      );
    }
    if (inspectorPanel === "properties") {
      if (!primarySelection) {
        return (
          <>
            <div className="cv-panel-heading"><div><h3>Properties</h3><p>Canvas and page settings</p></div></div>
            <div className="cv-field"><label>Project</label><input value={project.title} readOnly onClick={changeProjectTitle} /></div>
            <div className="cv-field"><label>Subject</label><input value={project.subject} readOnly onClick={changeSubject} /></div>
            <div className="cv-field"><label>Page title</label><input value={activePage.title} onChange={(event) => updateActivePage((page) => ({ ...page, title: event.target.value }))} /></div>
            <div className="cv-field"><label>Background</label>
              <select value={activePage.background} onChange={(event) => updateActivePage((page) => ({ ...page, background: event.target.value as CanvasPage["background"] }), true)}>
                <option value="dark">Dark dotted</option><option value="blackboard">Blackboard</option><option value="whiteboard">Whiteboard</option><option value="paper">Warm paper</option><option value="graph">Graph paper</option>
              </select>
            </div>
            <div className="cv-field"><label>Template</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button className="cv-action w-full"><Sparkles size={14} /> Add editable template <ChevronDown size={13} /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-950 border-white/10 text-zinc-200">
                  <DropdownMenuItem onClick={() => applyTemplate("chemistry")}>Chemistry Reaction Board</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyTemplate("mindmap")}>Chapter Mind Map</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyTemplate("formula")}>Formula Sheet</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyTemplate("revision")}>Exam Revision Board</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        );
      }
      return (
        <>
          <div className="cv-panel-heading">
            <div><h3>{objectLabel(primarySelection)}</h3><p>{selectedObjects.length > 1 ? `${selectedObjects.length} objects selected` : primarySelection.type}</p></div>
            <button className="cv-mini-icon" onClick={() => updateSelected({ locked: !primarySelection.locked })}>{primarySelection.locked ? <Unlock size={14} /> : <Lock size={14} />}</button>
          </div>
          <div className="cv-field"><label>Layer name</label><input value={primarySelection.name} onChange={(event) => updateSelected({ name: event.target.value }, false)} /></div>
          {primarySelection.text !== undefined && (
            <div className="cv-field"><label>{primarySelection.type === "formula" ? "LaTeX source" : "Content"}</label><textarea value={primarySelection.text} onChange={(event) => updateSelected({ text: event.target.value }, false)} /></div>
          )}
          {primarySelection.type === "formula" && (
            <div className="cv-composer-preview"><ScholarAIContent content={`\\[${primarySelection.text}\\]`} mode="compact" normalizeLegacy={false} /></div>
          )}
          <div className="cv-properties-grid">
            <div className="cv-field"><label>Width</label><input type="number" min={28} value={Math.round(primarySelection.width)} onChange={(event) => updateSelected({ width: Math.max(28, Number(event.target.value)) }, false)} /></div>
            <div className="cv-field"><label>Height</label><input type="number" min={28} value={Math.round(primarySelection.height)} onChange={(event) => updateSelected({ height: Math.max(28, Number(event.target.value)) }, false)} /></div>
          </div>
          <div className="cv-field"><label>Rotation · {Math.round(primarySelection.rotation)}°</label><input className="cv-range" type="range" min={-180} max={180} value={primarySelection.rotation} onChange={(event) => updateSelected({ rotation: Number(event.target.value) }, false)} /></div>
          <div className="cv-field"><label>Opacity · {Math.round(primarySelection.opacity * 100)}%</label><input className="cv-range" type="range" min={5} max={100} value={primarySelection.opacity * 100} onChange={(event) => updateSelected({ opacity: Number(event.target.value) / 100 }, false)} /></div>
          <div className="cv-field"><label>Colour</label><div className="cv-color-row">{COLORS.map((swatch) => <button key={swatch} className="cv-swatch" data-active={primarySelection.color === swatch} style={{ background: swatch }} onClick={() => updateSelected({ color: swatch })} aria-label={`Set colour ${swatch}`} />)}</div></div>
          {primarySelection.type === "shape" && (
            <div className="cv-field"><label>Shape</label><select value={primarySelection.shape} onChange={(event) => updateSelected({ shape: event.target.value as CanvasObject["shape"] })}><option value="rounded">Rounded rectangle</option><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="triangle">Triangle</option><option value="diamond">Diamond</option><option value="hexagon">Hexagon</option></select></div>
          )}
          {primarySelection.type === "line" && (
            <div className="cv-field"><label>Connector style</label><select value={primarySelection.lineStyle} onChange={(event) => updateSelected({ lineStyle: event.target.value as CanvasObject["lineStyle"] })}><option value="solid">Straight</option><option value="dashed">Dashed</option><option value="curved">Curved</option><option value="elbow">Elbow</option></select></div>
          )}
          <button className="cv-action w-full mb-2" onClick={askLam}><Sparkles size={14} /> Ask LAM about selection</button>
          {primarySelection.type === "source" && primarySelection.sourceView && <button className="cv-action w-full" onClick={() => openSource(primarySelection)}><BookOpen size={14} /> Open source</button>}
        </>
      );
    }
    return (
      <>
        <div className="cv-panel-heading"><div><h3>Comments</h3><p>Local project notes</p></div><MessageCircle size={15} className="text-zinc-500" /></div>
        {comments.length === 0 && <p className="text-[11px] leading-5 text-zinc-500 mb-3">Add review notes here. Live multi-user comments are not enabled, so Scholar does not pretend other people are present.</p>}
        {comments.map((comment, index) => <div key={index} className="rounded-lg border border-white/8 bg-white/[.025] p-3 text-[11px] text-zinc-300 mb-2">{comment}</div>)}
        <div className="cv-field"><textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add a project note…" /></div>
        <button className="cv-action w-full" onClick={() => { if (commentDraft.trim()) { setComments((current) => [...current, commentDraft.trim()]); setCommentDraft(""); } }}><Plus size={14} /> Add note</button>
      </>
    );
  };

  return (
    <div className="-m-4 lg:-m-6 cv-root">
      <style>{CV_STYLE}</style>
      <div className="cv-shell">
        <header className="cv-header" aria-label="Canvas project controls">
          <div className="cv-header-title">
            <Grid3X3 size={16} className="text-teal-400 shrink-0" />
            <button className="cv-title-button" onClick={changeProjectTitle} title="Rename Canvas project">{project.title}</button>
            <button className="cv-badge" onClick={changeSubject}>{project.subject}</button>
          </div>
          <span className="cv-save" role="status">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed — retry" : `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          </span>
          <div className="cv-search">
            <Search />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this Canvas…" aria-label="Search Canvas" />
            <kbd>⌘ K</kbd>
            {filteredSearchResults.length > 0 && (
              <div className="absolute top-10 left-0 right-0 z-50 rounded-xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
                {filteredSearchResults.map(({ page, object }) => (
                  <button key={`${page.id}-${object.id}`} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] text-zinc-300 hover:bg-white/5" onClick={() => {
                    setProject((current) => ({ ...current, activePageId: page.id }));
                    window.setTimeout(() => focusObject(object), 0);
                  }}>
                    <Search size={12} className="text-teal-400" /><span className="truncate">{objectLabel(object)}</span><small className="ml-auto text-zinc-600">{page.title}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="cv-head-actions">
            <button className="cv-icon" onClick={undo} disabled={!undoStack.length} aria-label="Undo"><Undo2 size={15} /></button>
            <button className="cv-icon" onClick={redo} disabled={!redoStack.length} aria-label="Redo"><Redo2 size={15} /></button>
            <button className="cv-action cv-action-primary cv-hide-mobile" onClick={copyShareLink}><Share2 size={14} /><span>Share</span></button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button className="cv-action"><Download size={14} /><span>Export</span><ChevronDown size={12} /></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-950 border-white/10 text-zinc-200">
                <DropdownMenuLabel>Canvas export</DropdownMenuLabel>
                <DropdownMenuItem onClick={exportPng}><FileImage size={14} /> Current page as PNG</DropdownMenuItem>
                <DropdownMenuItem onClick={printPdf}><FileText size={14} /> Print / Save as PDF</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportProject}><Download size={14} /> Editable project file</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button className="cv-icon cv-hide-mobile" onClick={saveNow} aria-label="Save Canvas"><Save size={15} /></button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button className="cv-icon" aria-label="More Canvas actions"><MoreHorizontal size={16} /></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-950 border-white/10 text-zinc-200">
                <DropdownMenuLabel>Templates</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => applyTemplate("chemistry")}>Chemistry Reaction Board</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyTemplate("mindmap")}>Chapter Mind Map</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyTemplate("formula")}>Formula Sheet</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyTemplate("revision")}>Exam Revision Board</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={askLam}><Sparkles size={14} /> Ask LAM about Canvas</DropdownMenuItem>
                <DropdownMenuItem onClick={() => stageRef.current?.requestFullscreen()}><Maximize2 size={14} /> Fullscreen workspace</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="cv-main">
          <div ref={stageRef} className="cv-stage" data-cursor={stageCursor}>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onImageUpload} />
            <button className="cv-icon cv-panel-toggle" onClick={() => setInspectorOpen((open) => !open)} aria-label="Toggle Canvas inspector"><PanelRightOpen size={16} /></button>
            <div className="cv-toolrail" role="toolbar" aria-label="Canvas creation tools">
              {CORE_TOOLS.map((item) => (
                <div key={item.id}>
                  {item.divider && <div className="cv-tool-divider" />}
                  <button className="cv-tool" data-active={tool === item.id} onClick={() => item.id === "image" ? fileInputRef.current?.click() : setTool(item.id)} aria-label={`${item.label}${item.shortcut ? `, shortcut ${item.shortcut}` : ""}`} aria-pressed={tool === item.id}>
                    <item.icon size={17} /><span>{item.label}{item.shortcut && <b>{item.shortcut}</b>}</span>
                  </button>
                </div>
              ))}
              <div className="cv-tool-divider" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button className="cv-tool" aria-label="More Canvas tools"><MoreHorizontal size={17} /><span>More tools</span></button></DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="bg-zinc-950 border-white/10 text-zinc-200">
                  <DropdownMenuItem onClick={() => setTool("checklist")}><ListChecks size={14} /> Checklist</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openComposer("flashcard", worldCenter())}><Clipboard size={14} /> Flashcard</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openComposer("question", worldCenter())}><Circle size={14} /> Question card</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTool("source")}><BookOpen size={14} /> Scholar source card</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <svg
              ref={svgRef}
              role="application"
              aria-label={`${project.title}, infinite visual workspace, ${activePage.objects.length} objects`}
              tabIndex={0}
              onPointerDown={onSurfacePointerDown}
              onPointerMove={onSurfacePointerMove}
              onPointerUp={endInteraction}
              onPointerCancel={endInteraction}
              onWheel={onWheel}
            >
              <defs>
                <pattern id="cv-dot-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="1.2" cy="1.2" r="1" fill="rgba(255,255,255,.16)" />
                </pattern>
                <pattern id="cv-graph-pattern" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(16,185,129,.14)" strokeWidth="1" />
                </pattern>
                <marker id="cv-arrow-end" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke" /></marker>
                <marker id="cv-arrow-start" markerWidth="10" markerHeight="10" refX="2" refY="5" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M10,0 L0,5 L10,10 z" fill="context-stroke" /></marker>
              </defs>
              <rect className={`cv-grid-${activePage.background}`} width="100%" height="100%" />
              <g transform={worldTransform} data-canvas-world="true">
                <rect x={-20_000} y={-20_000} width={40_000} height={40_000} fill={activePage.background === "graph" ? "url(#cv-graph-pattern)" : activePage.background === "whiteboard" || activePage.background === "paper" ? "rgba(0,0,0,.025)" : "url(#cv-dot-pattern)"} />
                {visibleObjects.map((object) => (
                  <CanvasObjectRenderer key={object.id} object={object} selected={selectedIds.includes(object.id)} onPointerDown={onObjectPointerDown} onDoubleClick={(item) => openComposer(item.type, { x: item.x, y: item.y }, item)} />
                ))}
                {draftObject && <CanvasObjectRenderer object={draftObject} selected={false} onPointerDown={() => undefined} onDoubleClick={() => undefined} />}
                {marquee && <rect className="cv-marquee" {...marquee} />}
                {primarySelection && !primarySelection.locked && (
                  <circle className="cv-resize-handle" cx={primarySelection.x + primarySelection.width + 6} cy={primarySelection.y + primarySelection.height + 6} r={7 / activePage.viewport.zoom} onPointerDown={(event) => beginResize(event, primarySelection)} aria-label="Resize selected object" />
                )}
              </g>
            </svg>

            {activePage.objects.length === 0 && (
              <div className="cv-empty"><div><h2>Infinite Canvas</h2><p>Choose a tool, add an editable template, or drop in Scholar study material.</p></div></div>
            )}

            {selectedObjects.length > 0 && (
              <div className="cv-context" style={{ left: contextLeft, top: contextTop }}>
                <button onClick={() => primarySelection && openComposer(primarySelection.type, { x: primarySelection.x, y: primarySelection.y }, primarySelection)} aria-label="Edit selection"><Pencil size={14} /></button>
                <button onClick={duplicateSelected} aria-label="Duplicate selection"><Copy size={14} /></button>
                <button onClick={() => updateSelected({ locked: !primarySelection?.locked })} aria-label={primarySelection?.locked ? "Unlock selection" : "Lock selection"}>{primarySelection?.locked ? <Unlock size={14} /> : <Lock size={14} />}</button>
                {selectedIds.length > 1 && <button onClick={groupSelected} aria-label="Group selection"><Group size={14} /></button>}
                {selectedObjects.some((object) => object.groupId) && <button onClick={ungroupSelected} aria-label="Ungroup selection"><Ungroup size={14} /></button>}
                <button onClick={() => setLayerOrder("front")} aria-label="Bring to front"><BringToFront size={14} /></button>
                <button onClick={() => setLayerOrder("back")} aria-label="Send to back"><SendToBack size={14} /></button>
                <button onClick={askLam} aria-label="Ask LAM about selection"><Sparkles size={14} /></button>
                <button className="danger" onClick={deleteSelected} aria-label="Delete selection"><Trash2 size={14} /></button>
              </div>
            )}

            <div className="cv-bottom" aria-label="Canvas viewport controls">
              <button className="cv-icon" onClick={() => setZoom(activePage.viewport.zoom - 0.15)} aria-label="Zoom out"><ZoomOut size={15} /></button>
              <button className="cv-bottom-label" onClick={() => setZoom(1)}>{Math.round(activePage.viewport.zoom * 100)}%</button>
              <button className="cv-icon" onClick={() => setZoom(activePage.viewport.zoom + 0.15)} aria-label="Zoom in"><ZoomIn size={15} /></button>
              <button className="cv-icon" data-active={viewportLocked} onClick={() => setViewportLocked((locked) => !locked)} aria-label={viewportLocked ? "Unlock viewport" : "Lock viewport"}>{viewportLocked ? <Lock size={15} /> : <Unlock size={15} />}</button>
              <button className="cv-icon" onClick={() => fitObjects()} aria-label="Fit content"><Focus size={15} /></button>
              <button className="cv-icon" onClick={() => stageRef.current?.requestFullscreen()} aria-label="Fullscreen Canvas"><Maximize2 size={15} /></button>
            </div>
            <div className="cv-object-count">{activePage.objects.length} objects · {selectedIds.length} selected · Space+drag to pan</div>
          </div>

          <AnimatePresence>
            {inspectorOpen && (
              <motion.aside className="cv-panel" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} aria-label="Canvas inspector">
                <button className="cv-inspector-close" onClick={() => setInspectorOpen(false)} aria-label="Close Canvas inspector"><X size={15} /></button>
                <div className="cv-panel-tabs">
                  <button className="cv-panel-tab" data-active={inspectorPanel === "pages"} onClick={() => setInspectorPanel("pages")} aria-label="Pages"><BookOpen size={15} /></button>
                  <button className="cv-panel-tab" data-active={inspectorPanel === "layers"} onClick={() => setInspectorPanel("layers")} aria-label="Layers"><Layers size={15} /></button>
                  <button className="cv-panel-tab" data-active={inspectorPanel === "properties"} onClick={() => setInspectorPanel("properties")} aria-label="Properties"><SlidersHorizontal size={15} /></button>
                  <button className="cv-panel-tab" data-active={inspectorPanel === "comments"} onClick={() => setInspectorPanel("comments")} aria-label="Comments"><MessageCircle size={15} /></button>
                </div>
                <div className="cv-panel-body">{renderInspector()}</div>
              </motion.aside>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {composer && (
              <motion.div className="cv-composer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(event) => { if (event.target === event.currentTarget) setComposer(null); }}>
                <motion.div className="cv-composer" role="dialog" aria-modal="true" aria-label={`Edit ${composer.type}`} initial={{ scale: .96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .98, y: 8 }}>
                  <div className="cv-composer-head"><div><h2>{composer.editId ? "Edit" : "Add"} {composer.type}</h2><p className="text-[10px] text-zinc-500 mt-1">Structured Canvas object · double-click later to edit</p></div><button className="cv-icon" onClick={() => setComposer(null)} aria-label="Close editor"><X size={15} /></button></div>
                  <div className="cv-field"><label>Layer name</label><input autoFocus value={composer.name} onChange={(event) => setComposer((current) => current ? { ...current, name: event.target.value } : null)} /></div>
                  {composer.type === "source" && (
                    <div className="cv-properties-grid">
                      <div className="cv-field"><label>Source label</label><input value={composer.sourceLabel} onChange={(event) => setComposer((current) => current ? { ...current, sourceLabel: event.target.value } : null)} /></div>
                      <div className="cv-field"><label>Open in</label><select value={composer.sourceView} onChange={(event) => setComposer((current) => current ? { ...current, sourceView: event.target.value } : null)}><option value="ebook">E-Book</option><option value="files">Files</option><option value="notes">Notes</option><option value="quiz">Quiz</option><option value="answer-lab">Answer Lab</option><option value="ai-tools">AI Tools</option></select></div>
                    </div>
                  )}
                  <div className="cv-field"><label>{composer.type === "formula" ? "LaTeX" : composer.type === "table" ? "Rows separated by lines · columns by |" : "Content"}</label><textarea value={composer.text} onChange={(event) => setComposer((current) => current ? { ...current, text: event.target.value } : null)} /></div>
                  {composer.type === "formula" && <div className="cv-composer-preview"><ScholarAIContent content={`\\[${composer.text}\\]`} mode="compact" normalizeLegacy={false} /></div>}
                  <div className="cv-field"><label>Accent colour</label><div className="cv-color-row">{COLORS.map((swatch) => <button key={swatch} className="cv-swatch" data-active={color === swatch} style={{ background: swatch }} onClick={() => setColor(swatch)} aria-label={`Use ${swatch}`} />)}</div></div>
                  <div className="cv-composer-actions"><button className="cv-action" onClick={() => setComposer(null)}>Cancel</button><button className="cv-action cv-action-primary" onClick={applyComposer}><Check size={14} /> {composer.editId ? "Save changes" : "Add to Canvas"}</button></div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function Minimap({
  page,
  onNavigate,
}: {
  page: CanvasPage;
  onNavigate: (point: CanvasPoint) => void;
}) {
  const objects = page.objects.filter((object) => object.visible);
  const bounds = objectBounds(objects);
  const pad = 80;
  return (
    <div className="cv-minimap">
      <svg
        viewBox={`${bounds.x - pad} ${bounds.y - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`}
        role="img"
        aria-label="Canvas minimap"
        onPointerDown={(event) => {
          const svg = event.currentTarget;
          const point = svg.createSVGPoint();
          point.x = event.clientX;
          point.y = event.clientY;
          const local = point.matrixTransform(svg.getScreenCTM()?.inverse());
          onNavigate({ x: local.x, y: local.y });
        }}
      >
        <rect x={bounds.x - pad} y={bounds.y - pad} width={bounds.width + pad * 2} height={bounds.height + pad * 2} fill="#080a0a" />
        {objects.map((object) => (
          <rect
            key={object.id}
            x={object.x}
            y={object.y}
            width={Math.max(8, object.width)}
            height={Math.max(8, object.height)}
            rx={4}
            fill={object.fill && object.fill !== "transparent" ? object.fill : "rgba(45,212,191,.2)"}
            stroke={object.color}
            strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  );
}

export default CanvasView;
