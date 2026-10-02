export async function videoRequest(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
  method?: string
) {
  const response = await fetch(url, {
    method: method ?? (body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const json = await response.json();
  if (!response.ok)
    throw new Error(json.message ?? "LAMTube could not finish this request.");
  return json;
}
