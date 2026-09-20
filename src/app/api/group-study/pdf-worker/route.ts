import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const runtime = "nodejs";
/** Same-origin, versioned worker. No participant data or third-party CDN. */
export async function GET() {
  const source = await readFile(
    join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
  );
  return new Response(source, {
    headers: {
      "Content-Type": "text/javascript",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
