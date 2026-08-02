import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

export async function GET(_: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { reference } = await context.params;
  const payment = await db.scholarPaymentRequest.findFirst({
    where: user.role === UserRole.ADMIN ? { publicReference: reference } : { publicReference: reference, userId: user.id },
    select: { proofData: true, proofMimeType: true, proofFileName: true },
  });
  if (!payment?.proofData || !payment.proofMimeType) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return new NextResponse(new Uint8Array(payment.proofData), {
    headers: {
      "Content-Type": payment.proofMimeType,
      "Content-Disposition": `inline; filename="${(payment.proofFileName || "payment-proof").replace(/["\\\r\n]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
