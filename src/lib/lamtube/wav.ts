/** Parse RIFF chunks, not an assumed 44-byte header. Durations come from PCM bytes. */
export function wavInfo(bytes: Uint8Array) {
  if (bytes.length < 44 || bytes.length > 8_000_000)
    throw new Error("Invalid narration audio size");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WAVE")
    throw new Error("Narration must be WAV audio");
  let rate = 0;
  let length = 0;
  let format = 0;
  for (let cursor = 12; cursor + 8 <= bytes.length; ) {
    const size = view.getUint32(cursor + 4, true);
    const end = cursor + 8 + size;
    if (end > bytes.length) throw new Error("Truncated narration audio");
    if (ascii(cursor, 4) === "fmt " && size >= 16) {
      format = view.getUint16(cursor + 8, true);
      rate = view.getUint32(cursor + 16, true);
    }
    if (ascii(cursor, 4) === "data") length += size;
    cursor = end + (size % 2);
  }
  const duration = length / rate;
  if (
    ![1, 3].includes(format) ||
    !rate ||
    !length ||
    !Number.isFinite(duration) ||
    duration < 0.1 ||
    duration > 45
  )
    throw new Error("Unsupported narration audio");
  return { duration, size: bytes.byteLength };
}
