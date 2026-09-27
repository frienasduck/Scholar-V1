import "server-only";

export class AIRequestBodyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AIRequestBodyError";
  }
}

async function readBoundedBytes(request: Request, maxBytes: number, code: string, message: string): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AIRequestBodyError(message, 413, code);
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new AIRequestBodyError(message, 413, code);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Read JSON with an explicit streaming byte ceiling before provider work begins. */
export async function readBoundedAIJSON(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    throw new AIRequestBodyError("Content-Type must be application/json.", 415, "UNSUPPORTED_CONTENT_TYPE");
  }

  const text = new TextDecoder().decode(await readBoundedBytes(request, maxBytes, "AI_REQUEST_TOO_LARGE", "The AI request is too large."));
  if (!text.trim()) throw new AIRequestBodyError("The request body must be valid JSON.", 400, "INVALID_JSON_BODY");
  try {
    return JSON.parse(text);
  } catch {
    throw new AIRequestBodyError("The request body must be valid JSON.", 400, "INVALID_JSON_BODY");
  }
}

/** Parse multipart form data only after its byte stream has stayed under the ceiling. */
export async function readBoundedMultipartForm(request: Request, maxBytes: number): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new AIRequestBodyError("Audio uploads must use multipart form data.", 415, "UNSUPPORTED_CONTENT_TYPE");
  }
  const bytes = await readBoundedBytes(request, maxBytes, "TRANSCRIPTION_REQUEST_TOO_LARGE", "Provide a supported audio recording smaller than 4 MB.");
  try {
    const body = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]);
    return await new Response(body, { headers: { "Content-Type": contentType } }).formData();
  } catch {
    throw new AIRequestBodyError("The audio upload is malformed.", 400, "INVALID_MULTIPART_BODY");
  }
}
