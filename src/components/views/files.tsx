"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import { saveLocalFile, removeLocalFile } from "@/lib/local-files";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { SectionHeader, EmptyState, Pill } from "@/lib/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FilePreviewModal, detectPreviewType } from "@/components/files/file-preview-modal";
import { ReadyBackgroundVideo } from "@/components/ready-background-video";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Trash2, Download, Sparkles, FileText, Image as ImageIcon,
  FileVideo, FileAudio, File as FileIcon, Search, Loader2, X, HardDrive, MoreVertical,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";

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
  return detectPreviewType({ name, type, mimeType: type });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const FILTERS = ["All", "Images", "Videos", "Documents", "PDFs", "Audio", "Other", "Recent"] as const;

export function FilesView() {
  const accountId = useScholarAccess().user?.id;
  const files = useStore((s) => s.files) ?? [];
  const addFile = useStore((s) => s.addFile);
  const deleteFile = useStore((s) => s.deleteFile);
  const pushActivity = useStore((s) => s.pushActivity);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<typeof files[number] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [serverQuota, setServerQuota] = useState({ usedBytes: 0, limitBytes: 30 * 1024 * 1024 });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const target = sessionStorage.getItem("scholar:files:target");
    const file = files.find(item => item.id === target);
    if (file) setPreview(file);
    sessionStorage.removeItem("scholar:files:target");
  }, [files]);

  const refreshQuota = () => fetch("/api/files/quota", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : null)
    .then((value) => { if (value) setServerQuota(value); })
    .catch(() => undefined);

  useEffect(() => { void refreshQuota(); }, []);

  const filtered = useMemo(() => {
    let list = [...files];
    if (filter === "Images") list = list.filter((f) => getType(f.name, f.type) === "image");
    else if (filter === "Videos") list = list.filter((f) => getType(f.name, f.type) === "video");
    else if (filter === "Documents") list = list.filter((f) => ["office", "text", "code"].includes(getType(f.name, f.type)));
    else if (filter === "PDFs") list = list.filter((f) => getType(f.name, f.type) === "pdf");
    else if (filter === "Audio") list = list.filter((f) => getType(f.name, f.type) === "audio");
    else if (filter === "Other") list = list.filter((f) => !["image", "video", "pdf", "audio", "office", "text", "code"].includes(getType(f.name, f.type)));
    else if (filter === "Recent") list = list.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 6);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.tags.some((t) => t.toLowerCase().includes(q)));
    }
    return list.sort((a, b) => b.uploadedAt - a.uploadedAt);
  }, [files, filter, search]);

  const totalSize = Math.max(serverQuota.usedBytes, files.reduce((a, f) => a + f.size, 0));
  const storagePct = Math.min(100, (totalSize / serverQuota.limitBytes) * 100);

  async function handleUpload(fileList: FileList | null) {
    if (!fileList?.length || uploading) return;
    if (!accountId) { toast.error("Sign in to save files."); return; }
    setUploading(true);
    let uploaded = 0;
    try {
      for (const file of Array.from(fileList)) {
        if (!file.size || file.size > 100 * 1024 * 1024) { toast.error("Choose a nonempty file smaller than 100 MB."); continue; }
        const clientId = crypto.randomUUID();
        // Commit bytes before creating the visible entry. A storage failure
        // never becomes a successful-looking upload with missing content.
        const localBlobKey = await saveLocalFile(accountId, clientId, file);
        let reserved = false;
        try {
          const response = await fetch("/api/files/quota", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, name: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size }),
            signal: AbortSignal.timeout(20_000),
          });
          const value = await response.json();
          if (!response.ok) throw new Error(value.message || value.error || "The file allowance could not be checked.");
          reserved = true;
          addFile({ id: clientId, name: file.name, type: getType(file.name, file.type), mimeType: file.type, size: file.size, localBlobKey, tags: [] });
          uploaded += 1;
        } catch (error) {
          if (!reserved) await removeLocalFile(accountId, localBlobKey);
          throw error;
        }
      }
      if (uploaded) {
        pushActivity({ type: "file", text: `Saved ${uploaded} file(s) on this browser`, icon: "📎" });
        toast.success(`${uploaded} file(s) saved on this browser`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The upload could not finish. Please retry.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      void refreshQuota();
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete “${name}” from Scholar? Keep an original copy if you need it later.`)) return;
    try {
      const response = await fetch("/api/files/quota", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: id }), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("The file could not be deleted. Please retry.");
      const item = files.find(file => file.id === id);
      if (item?.localBlobKey && accountId) await removeLocalFile(accountId, item.localBlobKey);
      deleteFile(id);
      void refreshQuota();
      toast.success(`Deleted ${name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deletion failed. Your file has been kept.");
    }
  }

  return (
    <div className="relative -m-3 min-h-[calc(100vh-4rem)] overflow-hidden bg-black sm:-m-4 lg:-m-6">
      <ReadyBackgroundVideo
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4"
        readinessId="files"
        className="z-0"
      />
      <div className="absolute inset-0 z-0 bg-black/65" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6 p-4 pb-12 sm:p-6">
      <SectionHeader
        title="Files"
        subtitle="Save and organize study materials on this browser. Keep original copies; files are not backed up to the cloud."
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
            {formatSize(totalSize)} / {formatSize(serverQuota.limitBytes)}
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
                    {detectPreviewType(f) === "image" && f.dataUrl && (
                      <div className="-mx-4 -mt-4 mb-4 h-28 overflow-hidden rounded-t-xl bg-muted">
                        <img src={f.dataUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      </div>
                    )}
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
                        {f.dataUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Download ${f.name}`}
                            className="h-7 w-7 opacity-70 hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              const anchor = document.createElement("a");
                              anchor.href = f.dataUrl!;
                              anchor.download = f.name;
                              anchor.click();
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`More actions for ${f.name}`} className="h-7 w-7" onClick={(e) => e.stopPropagation()}><MoreVertical className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                            <DropdownMenuItem onClick={() => setPreview(f)}>Preview</DropdownMenuItem>
                            {f.dataUrl ? <DropdownMenuItem onClick={() => { const anchor = document.createElement("a"); anchor.href = f.dataUrl!; anchor.download = f.name; anchor.click(); }}>Download</DropdownMenuItem> : null}
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(f.id, f.name)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
      {preview && (
        <FilePreviewModal
          file={preview}
          files={filtered}
          onClose={() => setPreview(null)}
          onPrevious={() => {
            const index = filtered.findIndex((file) => file.id === preview.id);
            setPreview(filtered[(index - 1 + filtered.length) % filtered.length]);
          }}
          onNext={() => {
            const index = filtered.findIndex((file) => file.id === preview.id);
            setPreview(filtered[(index + 1) % filtered.length]);
          }}
        />
      )}
      </div>
    </div>
  );
}
