import { NextResponse } from "next/server";
import { publicAuthConfig } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(publicAuthConfig(), { headers: { "Cache-Control": "no-store" } });
}
