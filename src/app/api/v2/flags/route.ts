import { NextResponse } from "next/server";
import { publicV2Flags, flagRegistry } from "@/lib/v2/flags";

/** Client-safe flag snapshot: code defaults only (never env/DB truth). */
export async function GET() {
  return NextResponse.json({ flags: publicV2Flags(), registry: flagRegistry() });
}
