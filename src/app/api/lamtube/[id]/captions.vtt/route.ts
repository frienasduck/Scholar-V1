import { authorize, fail } from "@/lib/lamtube/http";
import { readRender, readVideo } from "@/lib/lamtube/store";
import { ProfileError } from "@/lib/personalization/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authorize(request);
    const { id } = await context.params;
    const video = await readVideo(user.id, id);
    const rendered = await readRender(user.id, id);
    if (!rendered || video.status !== "ready") {
      throw new ProfileError("Video captions are not ready yet.", 404);
    }
    return new Response(rendered.captionsVtt || "WEBVTT\n\n", {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
