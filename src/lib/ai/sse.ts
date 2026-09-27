const DEFAULT_MAX_BUFFER_CHARACTERS = 1_000_000;

export type SSEChunkResult = {
  buffer: string;
  events: string[];
};

function dataForFrame(frame: string): string | null {
  const values: string[] = [];
  for (const line of frame.split(/\r\n|\r|\n/)) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    if (field !== "data") continue;
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    values.push(value);
  }
  return values.length ? values.join("\n") : null;
}

/**
 * Incrementally extracts data payloads from an SSE stream. It keeps CRLF
 * boundaries intact across network chunks and can flush a final frame when a
 * proxy closes the stream without a trailing blank line.
 */
export function consumeSSEChunk(
  previousBuffer: string,
  chunk: string,
  options: { flush?: boolean; maxBufferCharacters?: number } = {},
): SSEChunkResult {
  const maxBufferCharacters = options.maxBufferCharacters ?? DEFAULT_MAX_BUFFER_CHARACTERS;
  const combined = previousBuffer + chunk;
  if (combined.length > maxBufferCharacters) throw new Error("The AI stream exceeded its safe buffer limit.");

  const frames: string[] = [];
  const delimiter = /(?:\r\n|\r|\n){2}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = delimiter.exec(combined)) !== null) {
    frames.push(combined.slice(cursor, match.index));
    cursor = delimiter.lastIndex;
  }

  let buffer = combined.slice(cursor);
  if (options.flush && buffer.trim()) {
    frames.push(buffer);
    buffer = "";
  }

  return {
    buffer,
    events: frames.map(dataForFrame).filter((value): value is string => value !== null),
  };
}
