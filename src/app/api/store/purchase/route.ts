import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { STORE_PRODUCTS } from "@/data/store-catalog";
import { getSessionUser } from "@/lib/auth/session";
import { requireEntitlement } from "@/lib/subscriptions/entitlements";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

const schema = z.object({ productId: z.string().min(1).max(100) });

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    await enforceRateLimit(`store-purchase:${user.id}`, "store-purchase", 30, 60_000);
    const input = schema.safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    const product = STORE_PRODUCTS.find((item) => item.id === input.data.productId);
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (product.requiresPlus) {
      const gate = await requireEntitlement("store_plus_items");
      if (!gate.ok) return gate.response;
    }
    return NextResponse.json({ authorized: true, productId: product.id });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    return NextResponse.json({ error: "Purchase could not be authorized." }, { status: 500 });
  }
}
