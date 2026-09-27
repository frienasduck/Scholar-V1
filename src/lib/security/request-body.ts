import "server-only";

export class RequestBodyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export async function readBoundedBytes(request: Request, maxBytes: number) {
  const declared = request.headers.get("content-length");
  if (declared) {
    const size = Number(declared);
    if (!Number.isSafeInteger(size) || size < 0)
      throw new RequestBodyError("Invalid Content-Length.", 400, "INVALID_CONTENT_LENGTH");
    if (size > maxBytes)
      throw new RequestBodyError("The request body is too large.", 413, "REQUEST_TOO_LARGE");
  }
  if (!request.body)
    throw new RequestBodyError("The request body must be valid JSON.", 400, "INVALID_JSON_BODY");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyError("The request body is too large.", 413, "REQUEST_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/** Read an arbitrary textual body without buffering beyond the route ceiling. */
export async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  const bytes = await readBoundedBytes(request, maxBytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new RequestBodyError("The request body must be valid UTF-8 text.", 400, "INVALID_TEXT_BODY");
  }
}

/** Read a JSON request without buffering beyond the route-specific ceiling. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    throw new RequestBodyError("Content-Type must be application/json.", 415, "UNSUPPORTED_CONTENT_TYPE");
  }
  let text: string;
  try {
    text = await readBoundedText(request, maxBytes);
  } catch (error) {
    if (error instanceof RequestBodyError && error.code === "INVALID_TEXT_BODY") {
      throw new RequestBodyError("The request body must be valid UTF-8 JSON.", 400, "INVALID_JSON_BODY");
    }
    throw error;
  }
  if (!text.trim())
    throw new RequestBodyError("The request body must be valid JSON.", 400, "INVALID_JSON_BODY");
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestBodyError("The request body must be valid JSON.", 400, "INVALID_JSON_BODY");
  }
}
