"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";

type Checkout = {
  request: { publicReference: string; status: string; expectedAmountInr: number };
  payment: {
    qrAsset: string;
    upiId: string | null;
    phone: string | null;
    recipient: string;
    regularPriceInr?: number;
    offerLabel?: string;
  };
};

const navigate = (viewId: string) =>
  window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId } }));

export function SubscriptionPaymentView() {
  const access = useScholarAccess();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [payerName, setPayerName] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const recoverCheckout = async () => {
      try {
        const raw = sessionStorage.getItem("scholar:plus-checkout");
        if (raw) {
          setCheckout(JSON.parse(raw));
          return;
        }
        if (access.config?.subscriptionsEnabled === false) return;
        const response = await fetch("/api/subscriptions/payment-requests", { method: "POST" });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Payment request could not be opened.");
        if (!cancelled) {
          setCheckout(value);
          sessionStorage.setItem("scholar:plus-checkout", JSON.stringify(value));
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Payment request could not be opened.");
      } finally {
        if (!cancelled) setLoadingCheckout(false);
      }
    };
    void recoverCheckout();
    return () => {
      cancelled = true;
    };
  }, [access.config?.subscriptionsEnabled]);

  const submit = async () => {
    if (!checkout) return;
    const form = new FormData();
    form.append("payerName", payerName);
    form.append("transactionReference", reference);
    if (proof) form.append("proof", proof);
    setBusy(true);
    try {
      const response = await fetch(
        `/api/subscriptions/payment-requests/${encodeURIComponent(checkout.request.publicReference)}`,
        { method: "PATCH", body: form },
      );
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Proof could not be submitted.");
      const updated = { ...checkout, request: { ...checkout.request, status: "submitted" } };
      setCheckout(updated);
      sessionStorage.setItem("scholar:plus-checkout", JSON.stringify(updated));
      if (value.notice) {
        toast.info("Payment received", {
          description: value.notice,
        });
      } else {
        toast.success("Payment submitted for verification", {
          description: "Scholar Plus activates only after an administrator independently verifies the payment.",
        });
      }
      await access.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Proof could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!checkout) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/subscriptions/payment-requests/${encodeURIComponent(checkout.request.publicReference)}`,
        { method: "DELETE" },
      );
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "This request could not be cancelled.");
      sessionStorage.removeItem("scholar:plus-checkout");
      toast.info("Payment request cancelled");
      navigate("plus");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This request could not be cancelled.");
    } finally {
      setBusy(false);
    }
  };

  if (loadingCheckout) {
    return (
      <div className="mx-auto grid min-h-72 max-w-lg place-items-center rounded-3xl border border-white/10 bg-white/5">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-200" />
        <span className="sr-only">Opening secure payment request</span>
      </div>
    );
  }
  if (!checkout) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-2xl font-semibold">No payment request is open</h1>
        <p className="mt-2 text-sm text-white/50">Open Scholar Plus and choose Subscribe first.</p>
      </div>
    );
  }

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
    toast.success("Copied");
  };
  const regularPrice = checkout.payment.regularPriceInr ?? 300;
  const canCancel = checkout.request.status === "created" || checkout.request.status === "more_information_required";
  const submitted = checkout.request.status === "submitted";

  return (
    <main className="mx-auto w-full max-w-5xl px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:py-6">
      <section className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black/45 shadow-2xl backdrop-blur-2xl md:grid md:grid-cols-[.92fr_1.08fr]">
        <button
          type="button"
          onClick={() => navigate("plus")}
          aria-label="Close payment checkout"
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/60 text-white transition hover:bg-black/80"
        >
          <X className="h-4 w-4" />
        </button>

        {!submitted && (
          <div className="flex min-w-0 flex-col gap-5 bg-white p-5 text-black sm:p-7">
            <div className="min-w-0 pr-10">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[.2em] text-black/45">Scholar Plus · {checkout.request.publicReference}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <span className="text-sm text-black/40 line-through">₹{regularPrice}</span>
                <span className="text-3xl font-semibold sm:text-4xl">₹{checkout.request.expectedAmountInr}</span>
                {checkout.payment.offerLabel && (
                  <span className="mb-1 rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                    {checkout.payment.offerLabel}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-black/50">Access details are shown before payment.</p>
            </div>
            <div className="mx-auto w-full max-w-60 sm:max-w-72">
              <img
                src={checkout.payment.qrAsset}
                alt="Scholar Plus UPI payment QR code"
                className="h-auto w-full rounded-2xl object-contain shadow-lg"
              />
            </div>
            <div className="min-w-0 space-y-2.5 text-sm">
              <div className="rounded-2xl bg-black/[.04] px-4 py-3">
                <span className="text-xs text-black/45">Recipient</span>
                <p className="font-semibold break-words">{checkout.payment.recipient}</p>
              </div>
              {checkout.payment.upiId && (
                <button type="button" onClick={() => copy(checkout.payment.upiId!)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-black/10 px-4 py-3 text-left transition hover:bg-black/[.04]">
                  <span className="min-w-0">
                    <span className="text-xs text-black/45">UPI ID</span>
                    <br />
                    <span className="break-all">{checkout.payment.upiId}</span>
                  </span>
                  <Copy className="h-4 w-4 shrink-0" />
                </button>
              )}
              {checkout.payment.phone && (
                <button type="button" onClick={() => copy(checkout.payment.phone!)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-black/10 px-4 py-3 text-left transition hover:bg-black/[.04]">
                  <span className="min-w-0">
                    <span className="text-xs text-black/45">UPI phone</span>
                    <br />
                    <span className="break-all">{checkout.payment.phone}</span>
                  </span>
                  <Copy className="h-4 w-4 shrink-0" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-col p-5 text-white sm:p-7 md:p-8">
          {submitted ? (
            <div className="flex min-h-72 flex-col items-center justify-center py-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-200/20 bg-emerald-300/10 text-emerald-300">
                <Check className="h-6 w-6" />
              </span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">Payment under review</h1>
              <p className="mt-2 max-w-sm text-sm leading-6 text-white/60">
                Your payment details have been received. Scholar Plus will activate only after administrator approval.
              </p>
              <p className="mt-4 rounded-full border border-white/10 bg-white/[.06] px-4 py-1.5 text-xs text-white/55">
                Reference · {checkout.request.publicReference}
              </p>
              <button onClick={() => navigate("plus")} className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
                Back to Scholar Plus
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 pr-10">
                <span className="truncate text-xs uppercase tracking-widest text-cyan-200">{checkout.request.publicReference}</span>
                <span className="rounded-full border border-white/10 bg-white/[.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  {checkout.request.status.replaceAll("_", " ")}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Submit payment proof</h1>
              <ol className="mt-4 space-y-2.5 text-sm leading-6 text-white/65">
                <li><strong className="text-white">1.</strong> Scan the QR code or copy the UPI details.</li>
                <li><strong className="text-white">2.</strong> Pay exactly ₹{checkout.request.expectedAmountInr} to the recipient shown.</li>
                <li><strong className="text-white">3.</strong> Return here and enter the payer name and UPI transaction reference (UTR).</li>
                <li><strong className="text-white">4.</strong> Submit for verification. An administrator reviews payment independently.</li>
              </ol>
              <p className="mt-4 rounded-2xl border border-amber-200/15 bg-amber-200/[.06] p-3 text-xs leading-5 text-amber-100/75">
                Entering a reference or uploading a screenshot never activates Scholar Plus automatically.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/[.06] p-3 text-xs leading-5 text-cyan-100/80">
                    <p className="font-semibold text-cyan-100">Important</p>
                    <p className="mt-1">
                      Enter the exact payer name shown in the UPI transaction.
                      This must match the name from which the payment was sent.
                    </p>
                  </div>
                  <label className="mt-3 block text-xs font-medium text-white/55" htmlFor="plus-payer-name">Payer name</label>
                  <input
                    id="plus-payer-name"
                    value={payerName}
                    onChange={(event) => setPayerName(event.target.value)}
                    placeholder="Exact UPI payer name"
                    autoComplete="off"
                    className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300/50"
                  />
                  <p className="mt-1.5 text-[11px] leading-5 text-white/40">
                    Do not enter your Scholar profile name unless it matches the UPI sender name.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/55" htmlFor="plus-utr">UPI transaction reference (UTR)</label>
                  <input
                    id="plus-utr"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="UPI transaction reference / UTR"
                    autoComplete="off"
                    className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300/50"
                  />
                  <p className="mt-1.5 text-[11px] leading-5 text-white/40">The UTR is the 12-digit payment ID shown on your UPI app after you pay, so the administrator can confirm your transfer.</p>
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 p-4 text-sm text-white/60 transition hover:border-white/25">
                  <Upload className="h-5 w-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate">{proof ? proof.name : "Optional payment proof"}</span>
                    <span className="block text-[11px] text-white/40">PNG, JPG, WEBP or PDF · Maximum 5 MB</span>
                  </span>
                  <input hidden type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setProof(event.target.files?.[0] || null)} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" disabled={busy || !canCancel} onClick={cancel} className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/[.06] disabled:opacity-40">
                    Cancel
                  </button>
                  <button type="button" disabled={busy || !payerName.trim() || !reference.trim()} onClick={submit} className="flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-black shadow-[0_8px_30px_rgba(255,255,255,.18)] transition hover:bg-white/90 disabled:opacity-45">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit for Verification
                  </button>
                </div>
              </div>
              <p className="mt-5 flex gap-2 text-xs leading-5 text-white/40"><ShieldCheck className="h-4 w-4 shrink-0" />Only you and authenticated administrators can access the submitted proof.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
