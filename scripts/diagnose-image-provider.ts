// Explicit, synthetic one-request diagnostic; never prints authentication data.
const endpoint = process.env.AISIG_NVIDIA_ENDPOINT || "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";
const apiKey = process.env.AISIG_NVIDIA_API_KEY;
if (!apiKey) throw new Error("AISIG_NVIDIA_API_KEY is missing");
const response = await fetch(endpoint, {
  method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ prompt: "A simple educational diagram of a leaf on white paper.", width: 1024, height: 1024, cfg_scale: 1, samples: 1, seed: 0, steps: 4 }),
  signal: AbortSignal.timeout(90_000),
});
const url = new URL(endpoint);
console.info(JSON.stringify({ endpoint: `${url.origin}${url.pathname}`, status: response.status }));
if (!response.ok) {
  const value = await response.text();
  console.info(value.replaceAll(apiKey, "[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 1500));
}
export {};
