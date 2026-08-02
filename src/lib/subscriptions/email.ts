import "server-only";
import { subscriptionConfig } from "@/lib/subscriptions/config";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}
export async function sendScholarEmail(input: { to: string; subject: string; html: string; idempotencyKey: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = subscriptionConfig.resendFromEmail;
  if (!apiKey || !from) return { sent: false as const, reason: "EMAIL_NOT_CONFIGURED" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  if (!response.ok) return { sent: false as const, reason: "EMAIL_PROVIDER_UNAVAILABLE" };
  return { sent: true as const };
}

export function paymentAdminEmail(input: { title: string; userName: string; userEmail: string; userId: string; requestId: string; amountInr: number; reviewUrl: string; details?: string }) {
  return `<div style="font-family:system-ui,sans-serif;max-width:620px;margin:auto;padding:28px;background:#08121e;color:#eef7ff;border-radius:22px"><h1>${escapeHtml(input.title)}</h1><p><b>User:</b> ${escapeHtml(input.userName)} (${escapeHtml(input.userEmail)})</p><p><b>User ID:</b> ${escapeHtml(input.userId)}</p><p><b>Request:</b> ${escapeHtml(input.requestId)}</p><p><b>Expected amount:</b> ₹${escapeHtml(input.amountInr)}</p>${input.details ? `<p>${escapeHtml(input.details)}</p>` : ""}<p><a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#67e8f9;color:#07111d;text-decoration:none;font-weight:700">Open protected admin review</a></p><p style="opacity:.65;font-size:12px">This link never approves a payment. Sign-in with an authorized administrator account is required.</p></div>`;
}
