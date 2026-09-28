"use client";

import { useRef, useState } from "react";
import { Loader2, MessageSquarePlus, Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { toast } from "@/lib/notifications/notification-api";
import "./feedback.css";

export function FeedbackButton() {
  const access = useScholarAccess();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("feedback");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const form = new FormData();
      form.set("category", category); form.set("message", message); form.set("page", window.location.pathname);
      if (file) form.set("screenshot", file);
      const response = await fetch("/api/feedback", { method: "POST", body: form });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.message || "Could not send feedback.");
      setOpen(false); setMessage(""); setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      toast.success("Feedback sent", { description: "Thank you — the Scholar developer inbox received it." });
    } catch (error) { toast.error("Feedback not sent", { description: error instanceof Error ? error.message : "Please retry." }); }
    finally { setBusy(false); }
  };

  return <>
    <button type="button" className="scholar-feedback-trigger" onClick={() => setOpen(true)} aria-label="Send feedback" title="Feedback"><MessageSquarePlus className="size-4" /><span className="hidden xl:inline">Feedback</span></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="scholar-feedback-dialog">
        <DialogHeader><DialogTitle className="text-2xl font-semibold text-white">Help shape Scholar</DialogTitle><DialogDescription className="text-white/65">Report a bug, suggest a feature, or share what could be better. Your message goes to the Scholar developer.</DialogDescription></DialogHeader>
        {access.authenticated ? <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm text-white/75">Type<select className="scholar-feedback-field" value={category} onChange={(event) => setCategory(event.target.value)}><option value="feedback">General feedback</option><option value="bug">Bug or error</option><option value="feature">Feature idea</option><option value="request">Other request</option></select></label>
          <label className="grid gap-1.5 text-sm text-white/75">Your message<textarea className="scholar-feedback-field min-h-32 resize-y" minLength={10} maxLength={4000} required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what happened or what you would love to see…" /></label>
          <label className="scholar-feedback-attach"><Paperclip className="size-4" />{file ? file.name : "Attach a screenshot (optional, up to 1 MB)"}<input ref={fileInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
          <button type="submit" disabled={busy || message.trim().length < 10} className="scholar-feedback-submit">{busy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />}Send feedback</button>
        </form> : <p className="mt-4 rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/75">Sign in to send feedback to the Scholar developer.</p>}
      </DialogContent>
    </Dialog>
  </>;
}
