"use client";

// ============================================================================
// LAM × FICA — Custom Commands panel
// Users define their own trigger phrases that map onto approved Scholar
// actions (create reminder, focus session, apply template, exam rescue,
// navigate). No arbitrary code execution is ever allowed.
// ============================================================================

import { useRef, useState } from "react";
import { Copy, Download, Plus, Settings2, TestTube2, Trash2, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/lib/notifications/notification-api";
import { useReminderStore, useReminderProfile } from "@/lib/reminders/store";
import { testCommandAction } from "@/lib/reminders/lam-actions";
import type { CommandActionTemplate, LamCommand } from "@/lib/reminders/types";

type ActionKind = "create-reminder" | "start-focus" | "apply-template" | "exam-rescue" | "navigate";

const ACTION_KIND_META: Record<ActionKind, { label: string; desc: string }> = {
  "create-reminder": { label: "Create a reminder", desc: "Creates a reminder from your spoken text with default values." },
  "start-focus": { label: "Start a focus session", desc: "Opens Focus Mode with a fixed duration." },
  "apply-template": { label: "Apply a template", desc: "Creates a reminder from a saved template." },
  "exam-rescue": { label: "Exam rescue plan", desc: "Finds the next exam and builds a revision series." },
  navigate: { label: "Open a Scholar section", desc: "Navigates to an approved Scholar view." },
};

const NAV_VIEWS = ["study", "focus", "quiz", "flashcards", "revision-hub", "chapter-command", "practice", "notes", "assignments", "reminders"];

export function CustomCommandsPanel({ scholarClass }: { scholarClass: 9 | 11 }) {
  const profile = useReminderProfile(scholarClass);
  const store = useReminderStore;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LamCommand | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const commands = profile.commands;

  const exportCommands = () => {
    const blob = new Blob([JSON.stringify(commands, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scholar-lam-commands-${scholarClass === 11 ? "class11" : "class9"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Commands exported");
  };

  const importCommands = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("invalid");
        const valid = parsed.filter((c): c is LamCommand => c && typeof c.name === "string" && Array.isArray(c.triggers) && c.action && typeof c.action.type === "string");
        for (const c of valid) {
          store.getState().createCommand(scholarClass, {
            name: c.name, description: c.description, triggers: c.triggers,
            action: c.action as CommandActionTemplate, params: c.params ?? [],
            confirmRequired: c.confirmRequired ?? false, enabled: c.enabled ?? true,
          });
        }
        toast.success(`Imported ${valid.length} command${valid.length === 1 ? "" : "s"}`);
      } catch {
        toast.error("Invalid command file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-white/50">
          Custom phrases that trigger approved Scholar actions. Commands only run whitelisted operations — never your own code.
        </p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-[11px] border-white/15 bg-white/5 text-white" onClick={exportCommands}>
            <Download className="h-3 w-3 mr-1" /> Export
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px] border-white/15 bg-white/5 text-white" onClick={() => importRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> Import
          </Button>
          <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCommands(f); e.target.value = ""; }} />
          <Button size="sm" className="h-7 text-[11px] bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => { setEditing(null); setCreating(true); }}>
            <Plus className="h-3 w-3 mr-1" /> New command
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        {commands.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-xs text-white/40">No custom commands yet.</p>
        )}
        {commands.map((c) => (
          <div key={c.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300">
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-white">{c.name}</p>
                {c.builtIn && <span className="rounded-full border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/45">Default</span>}
                {!c.enabled && <span className="rounded-full border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/40">Off</span>}
                {c.usageCount > 0 && <span className="text-[10px] text-white/40">used {c.usageCount}×</span>}
              </div>
              {c.description && <p className="mt-0.5 text-[11px] text-white/45">{c.description}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {c.triggers.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-cyan-100/80">“{t}”</span>
                ))}
                {c.triggers.length > 3 && <span className="text-[10px] text-white/35">+{c.triggers.length - 3} more</span>}
              </div>
              <p className="mt-1 text-[10px] text-white/40">Action: {ACTION_KIND_META[c.action.type as ActionKind]?.label ?? c.action.type}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button onClick={() => { const r = testCommandAction(c, scholarClass); if (r.ok) toast.info(r.message); else toast.error(r.message); }}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60 hover:text-white transition-colors" title="Test command">
                <TestTube2 className="h-3 w-3 inline mr-1 -mt-0.5" />Test
              </button>
              <button onClick={() => { setEditing(c); setCreating(true); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60 hover:text-white transition-colors" title="Edit command">
                <Settings2 className="h-3 w-3 inline mr-1 -mt-0.5" />Edit
              </button>
              <button onClick={() => { store.getState().duplicateCommand(scholarClass, c.id); toast.success("Command duplicated"); }}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60 hover:text-white transition-colors" title="Duplicate command">
                <Copy className="h-3 w-3 inline mr-1 -mt-0.5" />Copy
              </button>
              <button onClick={() => { store.getState().removeCommand(scholarClass, c.id); toast.success("Command deleted"); }}
                className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2 py-1 text-[10px] text-rose-300/80 hover:text-rose-300 transition-colors" title="Delete command">
                <Trash2 className="h-3 w-3 inline mr-1 -mt-0.5" />Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <CommandEditorDialog
          scholarClass={scholarClass}
          command={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function CommandEditorDialog({ scholarClass, command, onClose }: { scholarClass: 9 | 11; command: LamCommand | null; onClose: () => void }) {
  const store = useReminderStore;
  const profile = useReminderProfile(scholarClass);
  const [name, setName] = useState(command?.name ?? "");
  const [description, setDescription] = useState(command?.description ?? "");
  const [triggers, setTriggers] = useState((command?.triggers ?? []).join("\n"));
  const [kind, setKind] = useState<ActionKind>((command?.action.type as ActionKind) ?? "create-reminder");
  const [focusMinutes, setFocusMinutes] = useState(command?.action.type === "start-focus" ? String((command.action as any).minutes ?? 25) : "25");
  const [templateName, setTemplateName] = useState(command?.action.type === "apply-template" ? String((command.action as any).templateName ?? "") : "");
  const [navView, setNavView] = useState(command?.action.type === "navigate" ? String((command.action as any).view ?? "study") : "study");
  const [defaultPriority, setDefaultPriority] = useState(command?.action.type === "create-reminder" ? String((command.action as any).defaults?.priority ?? "medium") : "medium");
  const [confirmRequired, setConfirmRequired] = useState(command?.confirmRequired ?? false);
  const [enabled, setEnabled] = useState(command?.enabled ?? true);

  const triggerList = triggers.split("\n").map((t) => t.trim()).filter(Boolean);

  const save = () => {
    if (!name.trim()) { toast.error("Give the command a name."); return; }
    if (!triggerList.length) { toast.error("Add at least one trigger phrase."); return; }
    // Conflict detection — identical triggers across commands.
    const existing = profile.commands.filter((c) => c.id !== command?.id);
    for (const t of triggerList) {
      const clash = existing.find((c) => c.triggers.includes(t.toLowerCase()));
      if (clash) { toast.error(`“${t}” is already used by “${clash.name}”.`); return; }
    }
    let action: CommandActionTemplate;
    if (kind === "start-focus") action = { type: "start-focus", minutes: Math.min(180, Math.max(1, Number(focusMinutes) || 25)) };
    else if (kind === "apply-template") action = { type: "apply-template", templateName: templateName || "Daily Revision" };
    else if (kind === "exam-rescue") action = { type: "exam-rescue" };
    else if (kind === "navigate") action = { type: "navigate", view: navView };
    else action = { type: "create-reminder", defaults: { title: name.trim(), priority: defaultPriority as any } };

    if (command) {
      store.getState().updateCommand(scholarClass, command.id, { name: name.trim(), description: description.trim() || undefined, triggers: triggerList, action, confirmRequired, enabled });
      toast.success("Command updated");
    } else {
      store.getState().createCommand(scholarClass, { name: name.trim(), description: description.trim() || undefined, triggers: triggerList, action, confirmRequired, enabled });
      toast.success("Command created");
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="border-white/15 bg-slate-950/95 backdrop-blur-xl text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{command ? "Edit custom command" : "New custom command"}</DialogTitle>
          <DialogDescription className="text-white/60">Trigger phrases run approved Scholar actions only.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">Command name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Study Sprint" className="bg-white/5 border-white/15 text-white" />
          </div>
          <div>
            <Label className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">Trigger phrases (one per line)</Label>
            <Textarea value={triggers} onChange={(e) => setTriggers(e.target.value)} rows={2} placeholder={"start study sprint\ncreate a study sprint"} className="bg-white/5 border-white/15 text-white" />
          </div>
          <div>
            <Label className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this command do?" className="bg-white/5 border-white/15 text-white" />
          </div>
          <div>
            <Label className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">Action</Label>
            <select value={kind} onChange={(e) => setKind(e.target.value as ActionKind)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
              {Object.entries(ACTION_KIND_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>
            <p className="mt-1 text-[10px] text-white/40">{ACTION_KIND_META[kind].desc}</p>
          </div>
          {kind === "start-focus" && (
            <div>
              <Label className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">Focus minutes</Label>
              <Input type="number" min={5} max={180} value={focusMinutes} onChange={(e) => setFocusMinutes(e.target.value)} className="bg-white/5 border-white/15 text-white" />
            </div>
          )}
          {kind === "apply-template" && (
            <div>
              <Label className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">Template</Label>
              <select value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                {profile.templates.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          )}
          {kind === "navigate" && (
            <div>
              <Label className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">Scholar section</Label>
              <select value={navView} onChange={(e) => setNavView(e.target.value)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                {NAV_VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          {kind === "create-reminder" && (
            <div>
              <Label className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">Default priority</Label>
              <select value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white/80">Require confirmation</p>
              <p className="text-[10px] text-white/40">Ask before running this command</p>
            </div>
            <Switch checked={confirmRequired} onCheckedChange={setConfirmRequired} aria-label="Require confirmation" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white/80">Enabled</p>
              <p className="text-[10px] text-white/40">LAM responds to this command</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enabled" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" className="text-white/70" onClick={onClose}>Cancel</Button>
          <Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={save}>{command ? "Save changes" : "Create command"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
