import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { mutationOrigin } from "@/lib/resources/http";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { RequestBodyError } from "@/lib/security/request-body";
export async function connectionUser(request: Request, write = false) {
  if (write && !mutationOrigin(request)) throw new Error("ORIGIN_REJECTED");
  const user = await getSessionUser(); if (!user) throw new Error("AUTH_REQUIRED");
  await enforceRateLimit(user.id, write ? "connector-mutation" : "connector-read", write ? 15 : 60, 60_000);
  return user;
}
export function connectionError(error: unknown) {
  if (error instanceof RequestBodyError) return NextResponse.json({ message: error.message }, { status: error.status });
  if (error instanceof RateLimitError) return NextResponse.json({ message: "Please wait before trying again." }, { status: 429 });
  const code = error instanceof Error ? error.message : "";
  const known: Record<string, [number, string]> = {
    AUTH_REQUIRED: [401, "Sign in to connect your private files."], ORIGIN_REJECTED: [403, "This request is not permitted."], DRIVE_NOT_CONFIGURED: [503, "Google Drive requires administrator configuration."],
    DRIVE_CONNECT_REQUIRED: [409, "Connect Google Drive first."], DRIVE_RECONNECT_REQUIRED: [409, "Reconnect Google Drive to renew access."], DRIVE_CONNECTION_CHANGED: [409, "Your connection changed. Retry."],
    DRIVE_FILE_UNAVAILABLE: [403, "Google has not granted Scholar access to this file, or it is unavailable."], DRIVE_FILE_UNSUPPORTED: [415, "Choose a PDF or Google Doc that allows downloads."],
    INVALID_FILE_ID: [400, "Choose a valid Drive file."], PDF_SIZE: [413, "Choose a file no larger than 4 MB."], DRIVE_REVOCATION_PENDING: [503, "Access in Scholar is disabled. Google revocation is pending; retry Disconnect."], REVOCATION_PENDING: [409, "Retry Disconnect before reconnecting."],
  };
  const [status, message] = known[code] ?? [503, "Connections are unavailable. Check configuration and the connector migration, then retry."];
  return NextResponse.json({ message }, { status, headers: { "Cache-Control": "private, no-store" } });
}
