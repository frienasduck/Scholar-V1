import { authorize, fail } from "@/lib/lamtube/http";
import { readAsset } from "@/lib/lamtube/store";
import { ProfileError } from "@/lib/personalization/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; key: string }> }
) {
  try {
    const user = await authorize(request);
    const { id, key } = await context.params;
    const asset = await readAsset(user.id, id, key);
    if (!asset) {
      throw new ProfileError("Video visual plate not found.", 404);
    }
    return new Response(new Uint8Array(asset.bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType || "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
