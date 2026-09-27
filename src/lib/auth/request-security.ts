import "server-only";
import { authBaseUrl } from "./config";
import { RequestBodyError } from "@/lib/security/request-body";

/** JSON mutations, SameSite cookies and Origin/Fetch Metadata checks; no CORS. */
export function assertAuthMutation(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || (origin && origin !== new URL(request.url).origin && origin !== authBaseUrl())) {
    throw new RequestBodyError("This authentication request is not allowed.", 403, "ORIGIN_REJECTED");
  }
  if (site && !origin) throw new RequestBodyError("Missing authentication request origin.", 403, "ORIGIN_REJECTED");
}
