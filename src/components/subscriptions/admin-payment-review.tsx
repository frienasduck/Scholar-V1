"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, RefreshCw, ShieldCheck, X } from "lucide-react";

type Payment = {
  id: string; publicReference: string; status: string; expectedAmountInr: number; currency: string;
  payerName: string | null; transactionReference: string | null; hasProof: boolean; proofMimeType: string | null;
  createdAt: string; proofSubmittedAt: string | null; reviewedAt: string | null; reviewNote: string | null;
  internalAdminNote: string | null; user: { id: string; name: string | null; email: string; coins: number };
  previous: Array<{ publicReference: string; status: string; expectedAmountPaise: number; createdAt: string }>;
};

export function AdminPaymentReview({ requestId }: { requestId: string }) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const response = await fetch(`/api/admin/subscriptions/payment-requests/${encodeURIComponent(requestId)}`, { cache: "no-store" });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "The request could not be loaded.");
    setPayment(value.payment);
    setInternalNote(value.payment.internalAdminNote || "");
  };

  useEffect(() => { void refresh().catch((error) => setMessage(error.message)); }, [requestId]);

  const act = async (action: "approve" | "reject" | "request_information") => {
    if (action !== "approve" && !reason.trim()) { setMessage("Enter a reason first."); return; }
    if (action === "approve" && !window.confirm("Confirm that the payment was independently verified and activate Scholar Plus?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/subscriptions/payment-requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: reason.trim() || undefined,
          internalNote: internalNote.trim() || undefined,
          durationDays: action === "approve" && durationDays ? Number(durationDays) : undefined,
        }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "The action failed.");
      setMessage(action === "approve" ? "Scholar Plus was activated securely." : "The review status was updated.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The action failed."); }
    finally { setBusy(false); }
  };

  if (!payment) return <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/70">{message || "Loading protected payment request…"}</div>;
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 text-white sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[.24em] text-cyan-300">Protected admin review</p><h1 className="mt-2 text-3xl font-semibold">{payment.publicReference}</h1></div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm capitalize">{payment.status.replaceAll("_", " ")}</span>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[.06] p-6 backdrop-blur-xl">
          <h2 className="font-semibold">Payment</h2>
          <dl className="mt-4 space-y-3 text-sm text-white/70">
            <div><dt className="text-white/40">Expected amount</dt><dd className="text-lg text-white">₹{payment.expectedAmountInr}</dd></div>
            <div><dt className="text-white/40">Payer</dt><dd>{payment.payerName || "Not submitted"}</dd></div>
            <div><dt className="text-white/40">Transaction reference</dt><dd className="break-all">{payment.transactionReference || "Not submitted"}</dd></div>
          </dl>
          {payment.hasProof && <a className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm" target="_blank" rel="noreferrer" href={`/api/subscriptions/payment-requests/${encodeURIComponent(payment.publicReference)}/proof`}>Open private proof <ExternalLink className="h-4 w-4" /></a>}
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[.06] p-6 backdrop-blur-xl">
          <h2 className="font-semibold">Scholar user</h2>
          <p className="mt-4 text-lg">{payment.user.name || "Unnamed user"}</p><p className="text-sm text-white/60">{payment.user.email}</p>
          <p className="mt-4 text-sm text-white/50">User ID: <span className="break-all">{payment.user.id}</span></p>
          <p className="mt-2 text-sm text-white/50">Current coins: {payment.user.coins.toLocaleString()}</p>
          <p className="mt-2 text-sm text-white/50">Created: {new Date(payment.createdAt).toLocaleString()}</p>
          {payment.proofSubmittedAt && <p className="mt-2 text-sm text-white/50">Proof submitted: {new Date(payment.proofSubmittedAt).toLocaleString()}</p>}
        </div>
      </section>
      <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <h2 className="font-semibold">Previous payment requests</h2>
        {payment.previous.length === 0 ? (
          <p className="mt-3 text-sm text-white/45">No earlier requests for this account.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {payment.previous.map((item) => (
              <div key={item.publicReference} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <span className="font-medium">{item.publicReference}</span>
                <span className="text-white/55">₹{item.expectedAmountPaise / 100} · {item.status.replaceAll("_", " ")} · {new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <label className="text-sm text-white/70">Access duration in days (optional)</label>
        <input
          value={durationDays}
          onChange={(event) => setDurationDays(event.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Leave empty when no duration is configured"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none focus:border-cyan-300/50"
        />
        <label className="mt-4 block text-sm text-white/70">User-facing reason</label>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none focus:border-cyan-300/50" />
        <label className="mt-4 block text-sm text-white/70">Internal admin note (never shown to the user)</label>
        <textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none focus:border-cyan-300/50" />
        <div className="mt-5 flex flex-wrap gap-3">
          <button disabled={busy} onClick={() => act("approve")} className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 font-semibold text-black disabled:opacity-50"><Check className="h-4 w-4" /> Approve</button>
          <button disabled={busy} onClick={() => act("request_information")} className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 px-5 py-2.5 text-amber-200 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Request information</button>
          <button disabled={busy} onClick={() => act("reject")} className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 px-5 py-2.5 text-rose-200 disabled:opacity-50"><X className="h-4 w-4" /> Reject</button>
        </div>
        {message && <p role="status" className="mt-4 text-sm text-cyan-200">{message}</p>}
      </section>
      <p className="flex items-center gap-2 text-xs text-white/40"><ShieldCheck className="h-4 w-4" /> Opening the email link never approves payment; only this authenticated action can.</p>
    </main>
  );
}
