import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
import { canonicalUrl } from "./engine";
import { mathmlToTex } from "./mathml";

/** Fail closed for non-global IPv4/IPv6, including IPv4-mapped IPv6. */
export function isPublicAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 0 || b === 168) || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 || b === 51) || a === 203 && b === 0);
  }
  // Only global-unicast 2000::/3. No mapped, compatible, local, NAT64,
  // multicast, 6to4, Teredo or documentation addresses.
  return isIP(ip) === 6 && /^[23]/.test(ip) && !/^(2001:(?:0:|db8:|2:)|2002:)/.test(ip);
}
export async function resolvePublicUrl(input: string, signal = AbortSignal.timeout(5000)) {
  if (signal.aborted) throw new Error("Source DNS verification timed out.");
  const url = new URL(canonicalUrl(input));
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || !hostname.includes(".") && !isIP(hostname) || /\.(localhost|local|internal|test|invalid)$/.test(hostname)) throw new Error("This URL is not public.");
  let cancel: () => void = () => {};
  const deadline = new Promise<never>((_resolve, reject) => {
    cancel = () => reject(new Error("Source DNS verification timed out."));
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
  let addresses;
  try { addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await Promise.race([lookup(hostname, { all: true }), deadline]); }
  finally { signal.removeEventListener("abort", cancel); }
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error("Private network addresses are not allowed.");
  return { url, addresses };
}
/** Validate every redirect; pin DNS to the validated address to prevent rebinding. */
export async function safeFetch(input: string, options: { maxBytes?: number; headers?: Record<string, string>; head?: boolean } = {}) {
  const signal = AbortSignal.timeout(12_000);
  let current = input;
  for (let redirects = 0; redirects < 4; redirects++) {
    const { url, addresses } = await resolvePublicUrl(current, signal);
    const result = await new Promise<{ status: number; headers: Record<string, string>; bytes: Buffer }>((resolve, reject) => {
      const address = addresses.find(a => a.family === 4) ?? addresses[0];
      const req = request(url, {
        method: options.head ? "HEAD" : "GET", signal, family: address.family,
        headers: { "User-Agent": "ScholarResourceVerifier/1.0 (educational source metadata; bounded requests)", "Accept-Encoding": "identity", ...options.headers },
        lookup: (_host, opts, cb) => {
          if ((opts as { all?: boolean }).all) (cb as unknown as (error: null, values: typeof addresses) => void)(null, [address]);
          else cb(null, address.address, address.family);
        },
      }, response => {
        const status = response.statusCode ?? 0;
        const headers = Object.fromEntries(Object.entries(response.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v ?? ""]));
        if (options.head || status >= 300 && status < 400) { response.destroy(); resolve({ status, headers, bytes: Buffer.alloc(0) }); return; }
        const max = options.maxBytes ?? 512 * 1024;
        if (Number(headers["content-length"]) > max) { response.destroy(); reject(new Error("Source exceeds the import size limit.")); return; }
        const buffers: Buffer[] = []; let total = 0;
        response.on("data", (chunk: Buffer) => { total += chunk.length; if (total > max) response.destroy(new Error("Source exceeds the import size limit.")); else buffers.push(chunk); });
        response.on("end", () => resolve({ status, headers, bytes: Buffer.concat(buffers) }));
        response.on("error", reject);
      });
      req.on("error", reject); req.end();
    });
    if (result.status >= 300 && result.status < 400 && result.headers.location) { current = new URL(result.headers.location, url).toString(); continue; }
    if (result.status < 200 || result.status >= 300) throw new Error(`Source returned HTTP ${result.status}.`);
    if (/attachment/i.test(result.headers["content-disposition"] ?? "") && !options.head) throw new Error("Use file import for downloads.");
    return { ...result, url: url.toString() };
  }
  throw new Error("Too many source redirects.");
}
export function plainHtml(html: string) {
  // Prefer a supplied TeX image alternative on older Wikimedia pages. Modern
  // pages serve MathML only, so preserve its fractions, powers and subscripts.
  const hasTexAlternative = /<img\b[^>]*alt="[^"]*\\displaystyle/.test(html);
  return html.replace(/<(script|style|noscript|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    // Wikimedia supplies a TeX alt attribute on its math fallback image.
    // Remove duplicate MathML visual text and preserve the TeX source.
    .replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, math => hasTexAlternative ? "" : ` $${mathmlToTex(math)}$ `)
    .replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, (_m, alt: string) => alt.includes("\\displaystyle") ? ` $${alt}$ ` : ` ${alt} `)
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6]|section|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "").replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_m, hex, dec) => { const n = parseInt(hex ?? dec, hex ? 16 : 10); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_m, key) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[key as "amp"] ?? ""));
}
export function webpageMetadata(html: string) {
  const title = plainHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "Educational resource").trim().slice(0, 180);
  const description = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]).find(m => /name=["']description["']/i.test(m))?.match(/content=["']([^"']*)/i)?.[1] ?? "";
  return { title, description: plainHtml(description).slice(0, 800) };
}
