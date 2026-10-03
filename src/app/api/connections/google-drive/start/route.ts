import { NextRequest, NextResponse } from "next/server";
import { startDrive } from "@/lib/connections/google-drive";
import { connectionUser, connectionError } from "@/lib/connections/http";
export async function POST(request: NextRequest) { try { const user = await connectionUser(request, true); return NextResponse.json({ url: await startDrive(user.id) }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return connectionError(error); } }
