/** Pure policy, independently testable without credentials, a database or a browser. */
export function localGuestEnabled(env: Record<string, string | undefined> = process.env) {
    return env.NODE_ENV === "development" && env.SCHOLAR_DEV_GUEST_AI === "1" && env.SCHOLAR_DEV_GUEST_AI_LOCAL_SERVER === "1" && !env.VERCEL && !env.VERCEL_ENV && !env.VERCEL_URL && !env.DEPLOYMENT_URL && !env.CI;
}
export function isLoopback(host: string) { return ["localhost", "127.0.0.1", "[::1]"].includes(host.toLowerCase()); }
export function localGuestRequest(request: Request, env: Record<string, string | undefined> = process.env) {
    if (!localGuestEnabled(env)) return false;
    const url = new URL(request.url), host = request.headers.get("host");
    if(!host)return false;
    let hostURL:URL;try{hostURL=new URL(`http://${host}`);}catch{return false;}
    // Next's local route URL may normalize 127.0.0.1 to localhost. Both must be
    // literal loopback authorities on the same port; Origin matches actual Host.
    if (!isLoopback(url.hostname) || url.protocol !== "http:" || !isLoopback(hostURL.hostname) || hostURL.host!==host || hostURL.port!==url.port) return false;
    const forwarded = request.headers.get("x-forwarded-host");
    if (forwarded && forwarded !== host) return false;
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = request.headers.get("origin");
    return request.method === "GET" ? !origin || origin === hostURL.origin : origin === hostURL.origin;
}
export const DEV_GUEST_LIMITS = { requests: 12, inputBytes: 24000, outputTokens: 4000, reservedTokens: 336000, bodyBytes: 32000, preparations: 10 } as const;
/** Include response-schema input where the selected adapter actually sends it. */
export function localGuestInputBytes(prompt:string,provider:string,jsonSchema?:Record<string,unknown>) {
    const encoder=new TextEncoder();
    return encoder.encode(prompt).byteLength+400+(provider==="gemini"&&jsonSchema?encoder.encode(JSON.stringify(jsonSchema)).byteLength:0);
}
