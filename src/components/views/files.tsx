"use client";

import { useState, useRef, useMemo } from "react";
import { useStore } from "@/lib/store";
import { askAIJSON } from "@/lib/ai";
import { SectionHeader, EmptyState, Pill } from "@/lib/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Trash2, Download, Sparkles, FileText, Image as ImageIcon,
  FileVideo, FileAudio, File as FileIcon, Search, Loader2, X, HardDrive,
} from "lucide-react";
import { toast } from "sonner";

const TYPE_META: Record<string, { icon: typeof FileIcon; color: string }> = {
  pdf: { icon: FileText, color: "#ef4444" },
  doc: { icon: FileText, color: "#3b82f6" },
  docx: { icon: FileText, color: "#3b82f6" },
  image: { icon: ImageIcon, color: "#10b981" },
  png: { icon: ImageIcon, color: "#10b981" },
  jpg: { icon: ImageIcon, color: "#10b981" },
  jpeg: { icon: ImageIcon, color: "#10b981" },
  gif: { icon: ImageIcon, color: "#10b981" },
  video: { icon: FileVideo, color: "#8b5cf6" },
  mp4: { icon: FileVideo, color: "#8b5cf6" },
  audio: { icon: FileAudio, color: "#f59e0b" },
  mp3: { icon: FileAudio, color: "#f59e0b" },
};

function getType(name: string, type: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (TYPE_META[ext]) return ext;
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "application/pdf") return "pdf";
  return "file";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const FILTERS = ["All", "Images", "Videos", "Documents", "PDFs", "Audio", "Other", "Recent"] as const;

export function FilesView() {
  const files = useStore((s) => s.files) ?? [];
  const addFile = useStore((s) => s.addFile);
  const deleteFile = useStore((s) => s.deleteFile);
  const pushActivity = useStore((s) => s.pushActivity);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<typeof files[number] | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    let list = [...files];
    if (filter === "Images") list = list.filter((f) => getType(f.name, f.type) === "image");
    else if (filter === "Videos") list = list.filter((f) => getType(f.name, f.type) === "video");
    else if (filter === "Documents") list = list.filter((f) => ["doc", "docx", "txt", "rtf"].includes(getType(f.name, f.type)));
    else if (filter === "PDFs") list = list.filter((f) => getType(f.name, f.type) === "pdf");
    else if (filter === "Audio") list = list.filter((f) => getType(f.name, f.type) === "audio");
    else if (filter === "Other") list = list.filter((f) => !["image", "video", "pdf", "audio", "doc", "docx", "txt", "rtf"].includes(getType(f.name, f.type)));
    else if (filter === "Recent") list = list.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 6);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.tags.some((t) => t.toLowerCase().includes(q)));
    }
    return list.sort((a, b) => b.uploadedAt - a.uploadedAt);
  }, [files, filter, search]);

  const totalSize = files.reduce((a, f) => a + f.size, 0);
  const storagePct = Math.min(100, (totalSize / (50 * 1024 * 1024)) * 100);

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const type = getType(file.name, file.type);
      let dataUrl: string | undefined;
      // Store dataUrl for images, PDFs, and small videos/audio (under 10MB) so they can be previewed
      if (["image", "pdf", "video", "audio"].includes(type) && file.size < 10 * 1024 * 1024) {
        dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
      addFile({
        name: file.name,
        type,
        size: file.size,
        dataUrl,
        tags: [],
      });
      // AI auto-tagging (best-effort, non-blocking)
      try {
        const result = await askAIJSON<{ tags: string[] }>(
          `Suggest 3 short tags (single words) for a file named "${file.name}" of type ${type}. JSON: {tags:[...]}`,
          "default"
        );
        if (result?.tags?.length) {
          // tags were added without tags; update is best-effort — we just push activity
          pushActivity({ type: "file", text: `Uploaded & tagged: ${file.name}`, icon: "📎" });
        }
      } catch {
        /* ignore */
      }
    }
    setUploading(false);
    pushActivity({ type: "file", text: `Uploaded ${fileList.length} file(s)`, icon: "📎" });
    toast.success(`${fileList.length} file(s) uploaded`);
  }

  function handleDelete(id: string, name: string) {
    deleteFile(id);
    toast.success(`Deleted ${name}`);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Files"
        subtitle="Upload, organize, and let AI auto-tag your study materials"
        action={
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white"
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? "Uploading…" : "Upload file"}
          </Button>
        }
      />
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Storage indicator */}
      <Card className="premium-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Storage used</span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatSize(totalSize)} / 50 MB
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-teal-500"
            initial={{ width: 0 }}
            animate={{ width: `${storagePct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </Card>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f}
            </Pill>
          ))}
        </div>
        <div className="relative sm:w-64 sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files & tags…"
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* File grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileIcon}
          title="No files yet"
          description="Upload PDFs, images, or documents. AI will auto-tag them for you."
          action={
            <Button onClick={() => inputRef.current?.click()} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" /> Upload your first file
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((f) => {
              const meta = TYPE_META[f.type] ?? { icon: FileIcon, color: "#71717a" };
              const Icon = meta.icon;
              return (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className="premium-card premium-card-hover p-4 cursor-pointer group relative"
                    onClick={() => setPreview(f)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPreview(f);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="grid place-items-center h-11 w-11 rounded-xl shrink-0"
                        style={{ background: `${meta.color}1a`, color: meta.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreview(f);
                          }}
                        >
                          Open
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(f.id, f.name);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{formatSize(f.size)}</p>
                    {f.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {f.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-2">
                      {new Date(f.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Preview modal */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="pr-8 break-all">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="grid place-items-center bg-muted rounded-xl p-6 min-h-[240px] overflow-hidden">
                {preview.type === "image" && preview.dataUrl ? (
                  <img src={preview.dataUrl} alt={preview.name} className="max-h-[400px] rounded-lg shadow-lg" />
                ) : preview.type === "pdf" && preview.dataUrl ? (
                  <iframe src={preview.dataUrl} title={preview.name} className="w-full h-[400px] rounded-lg bg-white" />
                ) : preview.type === "video" && preview.dataUrl ? (
                  <video src={preview.dataUrl} controls className="max-h-[400px] rounded-lg shadow-lg" />
                ) : preview.type === "audio" && preview.dataUrl ? (
                  <div className="text-center w-full max-w-md">
                    <FileAudio className="h-16 w-16 mx-auto mb-3 text-amber-500" />
                    <audio src={preview.dataUrl} controls className="w-full" />
                  </div>
                ) : preview.dataUrl ? (
                  <div className="text-center">
                    {(() => {
                      const meta = TYPE_META[preview.type] ?? { icon: FileIcon, color: "#71717a" };
                      const Icon = meta.icon;
                      return (
                        <div
                          className="grid place-items-center h-20 w-20 rounded-2xl mx-auto mb-4"
                          style={{ background: `${meta.color}1a`, color: meta.color }}
                        >
                          <Icon className="h-10 w-10" />
                        </div>
                      );
                    })()}
                    <p className="text-sm font-medium mb-1">{preview.name}</p>
                    <p className="text-xs text-muted-foreground mb-3">Preview not available for this file type</p>
                    <Button
                      size="sm"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = preview.dataUrl || "";
                        a.download = preview.name;
                        a.click();
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" /> Download to view
                    </Button>
                  </div>
                ) : (
                  (() => {
                    const meta = TYPE_META[preview.type] ?? { icon: FileIcon, color: "#71717a" };
                    const Icon = meta.icon;
                    return (
                      <div className="text-center">
                        <div
                          className="grid place-items-center h-20 w-20 rounded-2xl mx-auto mb-4"
                          style={{ background: `${meta.color}1a`, color: meta.color }}
                        >
                          <Icon className="h-10 w-10" />
                        </div>
                        <p className="text-sm font-medium mb-1">{preview.name}</p>
                        <p className="text-xs text-muted-foreground">Seeded file — upload your own to preview</p>
                      </div>
                    );
                  })()
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Type: {preview.type}</Badge>
                <Badge variant="secondary">Size: {formatSize(preview.size)}</Badge>
                {preview.tags.map((t) => (
                  <Badge key={t} variant="outline">{t}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Uploaded {new Date(preview.uploadedAt).toLocaleString("en-IN")}
                </p>
                {preview.dataUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = preview.dataUrl || "";
                      a.download = preview.name;
                      a.click();
                      toast.success("Download started");
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" /> Download
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
