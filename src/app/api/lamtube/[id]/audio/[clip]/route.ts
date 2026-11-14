import { authorize, fail } from "@/lib/lamtube/http";
import { readAudioClipBytes } from "@/lib/lamtube/store";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; clip: string }> }
) {
  try {
    const user = await authorize(request);
    const { id, clip } = await context.params;
    const bytes = await readAudioClipBytes(user.id, id, clip, true);
    const length = bytes.byteLength;
    const range = request.headers.get("range");
    const headers = {
      "Content-Type": "audio/wav",
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    };
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = match ? Number(match[1]) : -1;
      const end = match?.[2] ? Number(match[2]) : length - 1;
      if (start < 0 || start >= length || end < start || end >= length)
        return new Response(null, {
          status: 416,
          headers: { ...headers, "Content-Range": `bytes */${length}` },
        });
      return new Response(new Uint8Array(bytes.slice(start, end + 1)), {
        status: 206,
        headers: {
          ...headers,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${length}`,
        },
      });
    }
    return new Response(new Uint8Array(bytes), {
      headers: { ...headers, "Content-Length": String(length) },
    });
  } catch (error) {
    return fail(error);
  }
}
