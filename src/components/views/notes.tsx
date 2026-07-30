"use client";

import { useStore, type Note } from "@/lib/store";
import { askAI } from "@/lib/ai";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { Markdown, EmptyState } from "@/lib/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Pin, Trash2, Download, Sparkles, FileText, Tag,
  ChevronLeft, ChevronRight, Clock, History, Bold, Italic, Code, Heading, List,
  Folder as FolderIcon, Loader2, MoreHorizontal, Mic,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ===== Helpers =====
const COLORS: Record<string, string> = {
  indigo: "#6366f1",
  teal: "#14b8a6",
  emerald: "#10b981",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
  fuchsia: "#d946ef",
};
const COLOR_KEYS = Object.keys(COLORS);

const colorDot = (c: string) => COLORS[c] ?? COLORS.indigo;

function timeAgo(t: number): string {
  const d = Date.now() - t;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 7 * 86_400_000) return `${Math.floor(d / 86_400_000)}d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const preview = (s: string) => s.replace(/[#*>`_-]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);

type VirtualFolder = "all" | "pinned" | "archive";
type Selection = { kind: "virtual"; id: VirtualFolder } | { kind: "folder"; id: string };

// ===== Mindloop global styles (injected once) =====
const MINDLOOP_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
.mindloop-font-sans { font-family: 'Inter', sans-serif; }
.mindloop-font-serif { font-family: 'Instrument Serif', serif; }
.mindloop-glass {
  background: rgba(255,255,255,0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
  position: relative;
  overflow: hidden;
}
.mindloop-glass::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.mindloop-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.mindloop-scroll::-webkit-scrollbar-track { background: transparent; }
.mindloop-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 999px; }
.mindloop-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
.mindloop-input::placeholder { color: rgba(255,255,255,0.4); }
`;

// ===== Main View =====
export function NotesView() {
  const notes = useStore((s) => s.notes);
  const folders = useStore((s) => s.folders);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const addFolder = useStore((s) => s.addFolder);
  const pushActivity = useStore((s) => s.pushActivity);
  const addXP = useStore((s) => s.addXP);

  const [selection, setSelection] = useState<Selection>({ kind: "virtual", id: "all" });
  const [search, setSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(notes[0]?.id ?? null);
  const [mobileTab, setMobileTab] = useState<"folders" | "list" | "editor">("list");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("violet");

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  );

  // Filtered notes for the middle pane
  const filteredNotes = useMemo(() => {
    let list = notes;
    if (selection.kind === "virtual") {
      if (selection.id === "all") list = notes;
      else if (selection.id === "pinned") list = notes.filter((n) => n.pinned);
      else if (selection.id === "archive") list = notes.filter((n) => n.folder === "Archive");
    } else {
      const f = folders.find((x) => x.id === selection.id);
      if (f) list = notes.filter((n) => n.folder === f.name);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    // Pinned first, then by updated desc
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes, folders, selection, search]);

  const folderCount = useCallback(
    (folderName: string) => notes.filter((n) => n.folder === folderName).length,
    [notes]
  );

  const handleNewNote = () => {
    const folderName =
      selection.kind === "folder"
        ? folders.find((x) => x.id === selection.id)?.name ?? "Personal"
        : "Personal";
    const id = addNote({ folder: folderName, title: "Untitled", content: "" });
    setSelectedNoteId(id);
    setMobileTab("editor");
    toast.success("New note created");
    addXP(2);
    pushActivity({ type: "note", text: "Created a new note", icon: "📝" });
  };

  const handleNewFolder = () => {
    const name = newFolderName.trim();
    if (!name) {
      toast.error("Folder name is required");
      return;
    }
    if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      toast.error("A folder with that name already exists");
      return;
    }
    addFolder({ name, color: newFolderColor });
    toast.success(`Folder "${name}" created`);
    setNewFolderName("");
    setNewFolderColor("violet");
    setNewFolderOpen(false);
  };

  const navLinks: { label: string; key: VirtualFolder }[] = [
    { label: "All", key: "all" },
    { label: "Pinned", key: "pinned" },
    { label: "Archive", key: "archive" },
  ];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style dangerouslySetInnerHTML={{ __html: MINDLOOP_STYLES }} />

      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/backgrounds/scholar-poster.svg"
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-40"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4"
          type="video/mp4"
        />
      </video>

      {/* Dark overlay */}
      <div className="absolute inset-0 z-0 bg-black/60" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
        {/* ===== Navbar ===== */}
        <nav className="flex items-center justify-between py-4 px-6">
          <div className="flex items-center gap-3">
            {/* Concentric circles logo */}
            <div className="relative grid place-items-center w-7 h-7">
              <div className="absolute inset-0 border-2 border-white/60 rounded-full" />
              <div className="w-3 h-3 border border-white/60 rounded-full" />
            </div>
            <span className="mindloop-font-sans font-bold text-white text-lg tracking-tight">
              Scholar Notes
            </span>
          </div>

          {/* Center nav links (desktop) */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((l) => (
              <button
                key={l.key}
                onClick={() => {
                  setSelection({ kind: "virtual", id: l.key });
                  setMobileTab("list");
                }}
                className={`text-sm transition-colors ${
                  selection.kind === "virtual" && selection.id === l.key
                    ? "text-white"
                    : "text-white/65 hover:text-white"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Right: New Note button */}
          <button
            onClick={handleNewNote}
            className="mindloop-glass rounded-full px-5 py-2 text-sm text-white mindloop-font-sans font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Note
          </button>
        </nav>

        {/* ===== Hero section ===== */}
        <section className="px-6 pt-4 pb-8 flex flex-col items-center text-center gap-4">
          <div className="mindloop-glass rounded-full px-4 py-1.5 text-sm text-white/65">
            Your study notes, reimagined
          </div>
          <h2 className="mindloop-font-sans text-4xl md:text-5xl text-white font-medium tracking-tight max-w-3xl">
            Get <span className="mindloop-font-serif italic font-normal">Inspired</span> with Your Notes
          </h2>
          <p className="text-white/65 text-sm max-w-xl leading-relaxed">
            Join your knowledge base for meaningful study updates, notes around every subject, and a shared journey toward depth and understanding.
          </p>
        </section>

        {/* ===== Mobile tab switcher ===== */}
        <div className="lg:hidden px-6 mb-3">
          <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as typeof mobileTab)}>
            <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10">
              <TabsTrigger value="folders" className="text-white/65 data-[state=active]:text-white data-[state=active]:bg-white/10">Folders</TabsTrigger>
              <TabsTrigger value="list" className="text-white/65 data-[state=active]:text-white data-[state=active]:bg-white/10">Notes</TabsTrigger>
              <TabsTrigger value="editor" className="text-white/65 data-[state=active]:text-white data-[state=active]:bg-white/10">Editor</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ===== 3-Pane layout ===== */}
        <div className="flex-1 px-6 pb-6 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_300px_1fr] gap-4 lg:h-[calc(100vh-26rem)] min-h-[480px]">
            {/* ===== Left: Folders ===== */}
            <div
              className={`mindloop-glass rounded-2xl p-3 flex flex-col gap-1 overflow-hidden ${
                mobileTab === "folders" ? "" : "hidden"
              } lg:flex`}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/65 mindloop-font-sans">
                  Folders
                </span>
                <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
                  <DialogTrigger asChild>
                    <button className="grid place-items-center h-7 w-7 rounded-md text-white/65 hover:text-white hover:bg-white/5 transition-colors">
                      <Plus className="h-4 w-4" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-black border-white/20 text-white">
                    <DialogHeader>
                      <DialogTitle className="text-white">New folder</DialogTitle>
                      <DialogDescription className="text-white/65">
                        Create a folder to organize your notes.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <Input
                        placeholder="Folder name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        autoFocus
                        className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus-visible:border-white/40"
                      />
                      <div>
                        <p className="text-xs text-white/65 mb-2">Color</p>
                        <div className="flex flex-wrap gap-2">
                          {COLOR_KEYS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setNewFolderColor(c)}
                              className={`h-7 w-7 rounded-full transition-transform ${
                                newFolderColor === c
                                  ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-110"
                                  : "hover:scale-105"
                              }`}
                              style={{ background: COLORS[c] }}
                              aria-label={c}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setNewFolderOpen(false)}
                        className="border-white/20 text-white hover:bg-white/10 hover:text-white"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleNewFolder}
                        className="bg-white text-black hover:bg-white/90"
                      >
                        Create folder
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <ScrollArea className="flex-1 -mx-1 px-1 mindloop-scroll">
                <div className="space-y-0.5">
                  <FolderRow
                    label="All notes"
                    count={notes.length}
                    active={selection.kind === "virtual" && selection.id === "all"}
                    onClick={() => {
                      setSelection({ kind: "virtual", id: "all" });
                      setMobileTab("list");
                    }}
                    color="#ffffff"
                    icon={<FileText className="h-4 w-4" />}
                  />
                  <FolderRow
                    label="Pinned"
                    count={notes.filter((n) => n.pinned).length}
                    active={selection.kind === "virtual" && selection.id === "pinned"}
                    onClick={() => {
                      setSelection({ kind: "virtual", id: "pinned" });
                      setMobileTab("list");
                    }}
                    color="#ffffff"
                    icon={<Pin className="h-4 w-4" />}
                  />
                  <FolderRow
                    label="Archive"
                    count={notes.filter((n) => n.folder === "Archive").length}
                    active={selection.kind === "virtual" && selection.id === "archive"}
                    onClick={() => {
                      setSelection({ kind: "virtual", id: "archive" });
                      setMobileTab("list");
                    }}
                    color="#ffffff"
                    icon={<FolderIcon className="h-4 w-4" />}
                  />
                  <div className="h-px bg-white/15 my-2" />
                  {folders.length === 0 && (
                    <p className="text-xs text-white/65 px-2 py-3">No folders yet.</p>
                  )}
                  {folders.map((f) => (
                    <FolderRow
                      key={f.id}
                      label={f.name}
                      count={folderCount(f.name)}
                      active={selection.kind === "folder" && selection.id === f.id}
                      onClick={() => {
                        setSelection({ kind: "folder", id: f.id });
                        setMobileTab("list");
                      }}
                      color={colorDot(f.color)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* ===== Middle: Notes list ===== */}
            <div
              className={`mindloop-glass rounded-2xl p-3 flex flex-col overflow-hidden ${
                mobileTab === "list" ? "" : "hidden"
              } lg:flex`}
            >
              <div className="relative mb-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                <input
                  placeholder="Search notes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mindloop-glass mindloop-input w-full rounded-full pl-10 pr-4 py-2 text-sm text-white bg-transparent outline-none"
                />
              </div>
              <ScrollArea className="flex-1 -mx-1 px-1 mindloop-scroll">
                <div className="space-y-1.5">
                  {filteredNotes.length === 0 && (
                    <div className="py-8 text-center text-sm text-white/65">No notes here yet.</div>
                  )}
                  <AnimatePresence initial={false}>
                    {filteredNotes.map((n) => (
                      <NoteCard
                        key={n.id}
                        note={n}
                        active={n.id === selectedNoteId}
                        onClick={() => {
                          setSelectedNoteId(n.id);
                          setMobileTab("editor");
                        }}
                        folderColor={folders.find((f) => f.name === n.folder)?.color}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </div>

            {/* ===== Right: Editor ===== */}
            <div
              className={`mindloop-glass rounded-2xl overflow-hidden flex flex-col ${
                mobileTab === "editor" ? "" : "hidden"
              } lg:flex`}
            >
              {selectedNote ? (
                <Editor
                  key={selectedNote.id}
                  note={selectedNote}
                  folders={folders}
                  onUpdate={updateNote}
                  onDelete={(id) => {
                    deleteNote(id);
                    toast.success("Note deleted");
                    const next = filteredNotes.find((x) => x.id !== id);
                    setSelectedNoteId(next?.id ?? null);
                    if (!next) setMobileTab("list");
                  }}
                  pushActivity={pushActivity}
                  addXP={addXP}
                />
              ) : (
                <div className="flex-1 grid place-items-center p-6">
                  <div className="text-center max-w-xs">
                    <div className="mx-auto mb-4 grid place-items-center h-14 w-14 rounded-full border border-white/20">
                      <FileText className="h-6 w-6 text-white/65" />
                    </div>
                    <h3 className="mindloop-font-sans text-white text-lg font-medium">No note selected</h3>
                    <p className="text-white/65 text-sm mt-1.5 mb-4">
                      Pick a note from the list, or create a new one to start writing.
                    </p>
                    <button
                      onClick={handleNewNote}
                      className="mindloop-glass rounded-full px-5 py-2 text-sm text-white inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                    >
                      <Plus className="h-4 w-4" />
                      New note
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== Bottom section: Search has changed ===== */}
        <section className="px-6 pb-10 pt-2">
          <div className="text-center mb-6">
            <h3 className="mindloop-font-sans text-2xl md:text-3xl text-white font-medium tracking-tight">
              Search has <span className="mindloop-font-serif italic font-normal">changed</span>
            </h3>
            <p className="text-white/65 text-sm mt-1.5">
              Powerful tools to extend how you capture and revisit your study notes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <BottomCard
              icon={<Sparkles className="h-5 w-5" />}
              title="AI Summarize"
              description="Turn long class notes into crisp, exam-ready summaries with one click."
            />
            <BottomCard
              icon={<Download className="h-5 w-5" />}
              title="PDF Export"
              description="Export any note as a beautifully branded PDF for revision on the go."
            />
            <BottomCard
              icon={<Mic className="h-5 w-5" />}
              title="Voice Notes"
              description="Speak your ideas and let them flow straight into your knowledge base."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

// ===== Folder Row =====
function FolderRow({
  label, count, active, onClick, color, icon,
}: {
  label: string; count: number; active: boolean; onClick: () => void;
  color: string; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all ${
        active
          ? "bg-white/10 text-white"
          : "text-white/65 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon ?? <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />}
      <span className="truncate flex-1 text-left">{label}</span>
      <span className="text-[11px] font-medium text-white/50 tabular-nums">{count}</span>
    </button>
  );
}

// ===== Note Card =====
function NoteCard({
  note, active, onClick, folderColor,
}: {
  note: Note; active: boolean; onClick: () => void; folderColor?: string;
}) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className={`group w-full text-left p-3 rounded-xl transition-all mindloop-glass ${
        active ? "ring-1 ring-white/40" : "hover:ring-1 hover:ring-white/20"
      }`}
      style={active ? { boxShadow: `inset 3px 0 0 ${colorDot(note.color)}` } : undefined}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {note.pinned && <Pin className="h-3 w-3 text-white shrink-0" fill="currentColor" />}
            <h3 className="text-sm font-medium truncate text-white">{note.title || "Untitled"}</h3>
          </div>
          <p className="text-xs text-white/65 mt-1 line-clamp-2 leading-relaxed">
            {preview(note.content) || "Empty note"}
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {note.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-[10px] py-0 px-1.5 h-4 inline-flex items-center rounded-full bg-white/10 text-white/70 font-normal"
              >
                #{t}
              </span>
            ))}
            <span className="text-[10px] text-white/50 ml-auto flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(note.updatedAt)}
            </span>
          </div>
        </div>
        {folderColor && (
          <span className="h-1.5 w-1.5 rounded-full mt-1 shrink-0" style={{ background: colorDot(folderColor) }} />
        )}
      </div>
    </motion.button>
  );
}

// ===== Editor =====
function Editor({
  note, folders, onUpdate, onDelete, pushActivity, addXP,
}: {
  note: Note;
  folders: { id: string; name: string; color: string; subject?: string }[];
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  pushActivity: (a: { type: string; text: string; icon?: string }) => void;
  addXP: (n: number) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState(note.tags.join(", "));
  const [color, setColor] = useState(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [folder, setFolder] = useState(note.folder);
  const [showPreview, setShowPreview] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  // Reset on note change (intentionally only on note.id — when the user picks a different note, we re-seed local state)
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags.join(", "));
    setColor(note.color);
    setPinned(note.pinned);
    setFolder(note.folder);
    lastSavedRef.current = `${note.title}|${note.content}|${note.tags.join(",")}|${note.color}|${note.pinned}|${note.folder}`;
    // We intentionally only depend on note.id so that editing a field doesn't clobber local state.
  }, [note.id]);

  // Debounced autosave (800ms)
  useEffect(() => {
    const snapshot = `${title}|${content}|${tags}|${color}|${pinned}|${folder}`;
    if (snapshot === lastSavedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const patch: Partial<Note> = {
        title: title || "Untitled",
        content,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        color,
        pinned,
        folder,
      };
      onUpdate(note.id, patch);
      lastSavedRef.current = snapshot;
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, content, tags, color, pinned, folder, note.id, onUpdate]);

  // ---- Toolbar: insert markdown at cursor ----
  const insertAround = (before: string, after: string = before, placeholder: string = "") => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = content.slice(start, end) || placeholder;
    const next = content.slice(0, start) + before + sel + after + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + sel.length;
    });
  };

  const insertLinePrefix = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + prefix.length;
    });
  };

  const handleAddTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    const cur = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    if (cur.includes(v)) { setTagInput(""); return; }
    setTags(cur.concat(v).join(", "));
    setTagInput("");
  };

  const handleSummarize = async () => {
    if (!content.trim()) {
      toast.error("Add some content first");
      return;
    }
    setSummarizing(true);
    try {
      const summary = await askAI(
        "Summarize this note concisely:\n\n" + content,
        "default"
      );
      const next = content + "\n\n---\n\n## ✨ AI Summary\n\n" + summary.trim() + "\n";
      setContent(next);
      onUpdate(note.id, { content: next });
      toast.success("Summary added to note");
      addXP(5);
      pushActivity({ type: "note", text: `Summarized note: ${title || "Untitled"}`, icon: "✨" });
    } catch (e) {
      toast.error("Could not summarize note. Try again.");
    } finally {
      setSummarizing(false);
    }
  };

  const handleExportPDF = () => {
    exportPDF({
      title: title || "Untitled",
      subtitle: folder,
      bodyHtml: mdToHtml(content),
      accent: colorDot(color),
    });
    toast.success("PDF opened in new tab");
  };

  const handleRestoreVersion = (v: { content: string; at: number }) => {
    setContent(v.content);
    onUpdate(note.id, { content: v.content });
    toast.success(`Restored version from ${new Date(v.at).toLocaleString()}`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header / toolbar */}
      <div className="border-b border-white/15 px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="mindloop-input flex-1 text-lg font-semibold bg-transparent border-0 outline-none text-white mindloop-font-sans"
          />
          <button
            className={`mindloop-glass grid place-items-center h-8 w-8 rounded-lg shrink-0 transition-colors ${
              pinned ? "text-white" : "text-white/70 hover:text-white"
            }`}
            onClick={() => setPinned(!pinned)}
            title="Pin note"
          >
            <Pin className="h-4 w-4" fill={pinned ? "currentColor" : "none"} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="mindloop-glass grid place-items-center h-8 w-8 rounded-lg shrink-0 text-white/70 hover:text-white transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black border-white/20 text-white">
              <DropdownMenuLabel className="text-white/65">Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleExportPDF} className="text-white hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white">
                <Download className="h-4 w-4 mr-2" /> Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSummarize} disabled={summarizing} className="text-white hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white">
                {summarizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                AI Summarize
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/15" />
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                className="text-white hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 flex-wrap">
          <ToolbarBtn title="Bold" onClick={() => insertAround("**", "**", "bold")}><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Italic" onClick={() => insertAround("*", "*", "italic")}><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Code" onClick={() => insertAround("`", "`", "code")}><Code className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Heading" onClick={() => insertLinePrefix("## ")}><Heading className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="List item" onClick={() => insertLinePrefix("- ")}><List className="h-3.5 w-3.5" /></ToolbarBtn>
          <div className="h-5 w-px bg-white/15 mx-1" />
          {/* Color picker */}
          <div className="flex items-center gap-1">
            {COLOR_KEYS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={c}
                className={`h-5 w-5 rounded-full transition-transform ${
                  color === c
                    ? "ring-2 ring-white ring-offset-1 ring-offset-black scale-110"
                    : "hover:scale-110"
                }`}
                style={{ background: COLORS[c] }}
              />
            ))}
          </div>
          <div className="h-5 w-px bg-white/15 mx-1" />
          {/* Folder selector */}
          <Select value={folder} onValueChange={setFolder}>
            <SelectTrigger className="h-8 w-[140px] text-xs bg-white/5 border-white/15 text-white hover:bg-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/20 text-white">
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.name} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">{f.name}</SelectItem>
              ))}
              <SelectItem value="Archive" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Archive</SelectItem>
            </SelectContent>
          </Select>
          <div className="h-5 w-px bg-white/15 mx-1" />
          {/* Tag input */}
          <div className="flex items-center gap-1 min-w-0">
            <Tag className="h-3.5 w-3.5 text-white/65 shrink-0" />
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="comma, separated, tags"
              className="mindloop-input h-8 w-[160px] text-xs bg-white/5 border border-white/15 rounded-md px-2 text-white outline-none focus:border-white/30"
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            {/* Version history */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="mindloop-glass rounded-lg h-8 px-2.5 text-xs text-white/70 hover:text-white transition-colors inline-flex items-center">
                  <History className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">History</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-black border-white/20 text-white">
                <DropdownMenuLabel className="text-white/65">
                  Version history ({note.versions.length})
                </DropdownMenuLabel>
                {note.versions.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-white/65">No previous versions yet.</div>
                ) : (
                  [...note.versions].reverse().slice(0, 5).map((v, i) => (
                    <DropdownMenuItem
                      key={i}
                      onClick={() => handleRestoreVersion(v)}
                      className="flex-col items-start py-2 text-white hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
                    >
                      <span className="text-xs font-medium">{new Date(v.at).toLocaleString()}</span>
                      <span className="text-[11px] text-white/65 line-clamp-1">{preview(v.content) || "Empty"}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              className={`mindloop-glass rounded-lg h-8 px-3 text-xs transition-colors ${
                showPreview ? "text-white ring-1 ring-white/30" : "text-white/70 hover:text-white"
              }`}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? "Edit" : "Preview"}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        className="flex-1 min-h-0 grid grid-cols-1 gap-0 overflow-hidden"
        style={{ gridTemplateColumns: showPreview ? "1fr 1fr" : "1fr" }}
      >
        <div className="flex flex-col min-h-0 border-r border-white/15 last:border-r-0">
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing in Markdown…  # Heading, **bold**, *italic*, `code`, - list items"
            className="mindloop-input mindloop-scroll flex-1 min-h-0 resize-none border-0 rounded-none bg-transparent font-mono text-sm leading-relaxed outline-none px-4 py-3 text-white"
          />
        </div>
        {showPreview && (
          <ScrollArea className="flex-1 min-h-0 mindloop-scroll">
            <div className="px-4 py-3 prose-neha text-white">
              {content.trim() ? (
                <Markdown content={content} />
              ) : (
                <p className="text-sm text-white/65">Nothing to preview yet.</p>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Status bar */}
      <div className="border-t border-white/15 px-4 py-1.5 flex items-center justify-between text-[11px] text-white/65">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          Autosaved
        </span>
        <span className="tabular-nums">
          {content.split(/\s+/).filter(Boolean).length} words · {content.length} chars
        </span>
      </div>

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="bg-black border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Delete this note?</DialogTitle>
            <DialogDescription className="text-white/65">
              This action cannot be undone. The note "{title || "Untitled"}" will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              className="border-white/20 text-white hover:bg-white/10 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(note.id);
                setConfirmDelete(false);
              }}
              className="bg-white text-black hover:bg-white/90"
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolbarBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="mindloop-glass grid place-items-center h-8 w-8 rounded-lg text-white/70 hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}

// ===== Bottom Card (Search has changed section) =====
function BottomCard({
  icon, title, description,
}: {
  icon: React.ReactNode; title: string; description: string;
}) {
  return (
    <div className="mindloop-glass rounded-2xl p-6 text-center">
      <div className="mx-auto mb-3 grid place-items-center h-10 w-10 rounded-full border border-white/20 text-white">
        {icon}
      </div>
      <h4 className="mindloop-font-sans text-white font-medium text-base mb-1.5">{title}</h4>
      <p className="text-white/65 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// Unused import guard (prevents tree-shake elimination if needed elsewhere)
void ChevronLeft; void ChevronRight; void Card; void TabsContent;
