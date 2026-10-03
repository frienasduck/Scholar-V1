import { NextRequest, NextResponse } from "next/server";
import { authBaseUrl } from "@/lib/auth/config";
/** Google Drive's Open-with launch only opens the browser. Never imports or connects without a user action. */
export async function GET(_request: NextRequest) { return NextResponse.redirect(`${authBaseUrl()}/settings?drive=opened#plugins-connections`); }
