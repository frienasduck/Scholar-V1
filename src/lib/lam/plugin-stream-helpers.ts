import { AIProviderError } from "@/lib/ai/errors";

export async function streamResponseToText(
  streamFn: (onDelta: (chunk: string) => void) => Promise<unknown>,
  onDelta?: (chunk: string) => void,
): Promise<string> {
  let full = "";
  await streamFn((delta) => {
    full += delta;
    onDelta?.(delta);
  });
  const trimmed = full.trim();
  if (!trimmed) {
    throw new AIProviderError("The AI returned no content. Please retry.", 502, "GROQ_EMPTY_RESPONSE");
  }
  return trimmed;
}
