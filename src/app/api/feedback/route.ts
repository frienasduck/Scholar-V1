import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { readBoundedBytes, RequestBodyError } from "@/lib/security/request-body";
import { sendScholarEmail } from "@/lib/subscriptions/email";
import { assertAuthMutation } from "@/lib/auth/request-security";

export const runtime = "nodejs";

const schema = z.object({ category: z.enum(["feedback", "bug", "feature", "request"]), message: z.string().trim().min(10).max(4000), page: z.string().max(200) });
const destination = "ishansalah123@gmail.com";
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sign in to send feedback." }, { status: 401 });
  try { assertAuthMutation(request); } catch { return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 }); }
  try { await enforceRateLimit(user.id, "scholar-feedback", 5, 60 * 60_000); }
  catch (error) { return NextResponse.json({ error: error instanceof RateLimitError ? "RATE_LIMITED" : "ACCESS_CHECK_FAILED" }, { status: error instanceof RateLimitError ? 429 : 503 }); }
  let form: FormData;
  try {
    const bytes = await readBoundedBytes(request, 2 * 1024 * 1024);
    form = await new Response(bytes as BodyInit, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch (error) { return NextResponse.json({ error: "INVALID_FEEDBACK", message: "Feedback must be under 2 MB." }, { status: error instanceof RequestBodyError ? error.status : 400 }); }
  const parsed = schema.safeParse({ category: form.get("category"), message: form.get("message"), page: form.get("page") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "INVALID_FEEDBACK", message: "Write at least 10 characters and choose a category." }, { status: 400 });
  const screenshot = form.get("screenshot");
  const attachments: Array<{ filename: string; content: string; content_type: string }> = [];
  if (screenshot instanceof File && screenshot.size) {
    if (screenshot.size > 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(screenshot.type)) return NextResponse.json({ error: "INVALID_SCREENSHOT", message: "Use a PNG, JPEG or WebP screenshot under 1 MB." }, { status: 400 });
    const bytes = Buffer.from(await screenshot.arrayBuffer());
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!(screenshot.type === "image/png" && png || screenshot.type === "image/jpeg" && jpeg || screenshot.type === "image/webp" && webp)) return NextResponse.json({ error: "INVALID_SCREENSHOT" }, { status: 400 });
    attachments.push({ filename: `scholar-feedback.${screenshot.type.split("/")[1]}`, content: bytes.toString("base64"), content_type: screenshot.type });
  }
  const { category, message, page } = parsed.data;
  const html = `<div style="font-family:system-ui,sans-serif"><h1>Scholar ${escape(category)}</h1><p><b>From:</b> ${escape(user.name ?? "Scholar user")} (${escape(user.email)})</p><p><b>Page:</b> ${escape(page)}</p><p style="white-space:pre-wrap">${escape(message)}</p><p>Screenshot: ${attachments.length ? "attached" : "none"}</p></div>`;
  try {
    const sent = await sendScholarEmail({ to: destination, subject: `[Scholar feedback] ${category}`, html, attachments, idempotencyKey: `feedback-${crypto.randomUUID()}` });
    if (!sent.sent) return NextResponse.json({ error: sent.reason, message: "Feedback could not be delivered right now. Please retry later." }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "DELIVERY_FAILED", message: "Feedback could not be delivered right now." }, { status: 503 }); }
}
