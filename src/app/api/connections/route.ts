import { NextRequest, NextResponse } from "next/server";
import { connectorProviders } from "@/lib/connections/registry";
import { driveStatus } from "@/lib/connections/google-drive";
import { connectionUser, connectionError } from "@/lib/connections/http";
export async function GET(request: NextRequest) {
  try { const user = await connectionUser(request); return NextResponse.json({ providers: [{ ...connectorProviders[0], ...await driveStatus(user.id) }] }, { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return connectionError(error); }
}
