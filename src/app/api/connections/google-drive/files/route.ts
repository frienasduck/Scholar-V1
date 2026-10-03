import { NextRequest, NextResponse } from "next/server";
import { connectorAdapters } from "@/lib/connections/adapters";
import { connectionUser, connectionError } from "@/lib/connections/http";
export async function GET(request: NextRequest) { try { const user = await connectionUser(request); return NextResponse.json(await connectorAdapters["google-drive"].list(user.id, request.nextUrl.searchParams.get("q") ?? "", request.nextUrl.searchParams.get("pageToken") ?? undefined), { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return connectionError(error); } }
