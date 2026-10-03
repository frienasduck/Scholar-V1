import { NextRequest, NextResponse } from "next/server";
import { connectorAdapters } from "@/lib/connections/adapters";
import { connectionUser, connectionError } from "@/lib/connections/http";
export async function DELETE(request: NextRequest) { try { const user = await connectionUser(request, true); await connectorAdapters["google-drive"].disconnect(user.id); return NextResponse.json({ ok: true }); } catch (error) { return connectionError(error); } }
