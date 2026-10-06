import { NextResponse } from "next/server";
import { isServerFlagEnabled } from "@/lib/v2/server-flags";

/** Presentation-only switch; never grants access to LAM or changes entitlements. */
export async function GET() {
  return NextResponse.json({ enabled: await isServerFlagEnabled("v2_lam_identity") }, { headers: { "Cache-Control": "no-store" } });
}
