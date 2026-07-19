import type { NextRequest } from "next/server";
import { POST as chatPost } from "./chat/route";

export const runtime = "nodejs";

// Backward-compatible entry point. LAM's canonical endpoint is /api/lam/chat.
export function POST(request: NextRequest) {
  return chatPost(request);
}
