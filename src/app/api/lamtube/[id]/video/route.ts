import { authorize, fail } from "@/lib/lamtube/http";
import { readRender, readVideo } from "@/lib/lamtube/store";
import { ProfileError } from "@/lib/personalization/server";

export const runtime = "nodejs";

function safeFilename(title: string) {
  const base = title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return `${base || "scholar-ai-lesson"}.mp4`;
}

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
      throw new ProfileError("Compiled MP4 video is not ready yet.", 404);
    }

    const bytes = rendered.bytes;
    const length = bytes.byteLength;
    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "1";
    const range = request.headers.get("range");

    const headers: Record<string, string> = {
      "Content-Type": rendered.meta.mimeType || "video/mp4",
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      ...(download ? { "Content-Disposition": `attachment; filename="${safeFilename(video.title)}"` } : {}),
    };

    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = match ? Number(match[1]) : -1;
      const end = match?.[2] ? Number(match[2]) : length - 1;
      if (start < 0 || start >= length || end < start || end >= length) {
        return new Response(null, {
          status: 416,
          headers: { ...headers, "Content-Range": `bytes */${length}` },
        });
      }
      return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
        status: 206,
        headers: {
          ...headers,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${length}`,
        },
      });
    }

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { ...headers, "Content-Length": String(length) },
    });
  } catch (error) {
    return fail(error);
  }
}
