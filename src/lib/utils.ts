import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize untrusted HTML (e.g. AI-generated output) before injecting it via
 * `dangerouslySetInnerHTML`. Strips dangerous tags and attributes while
 * preserving basic formatting (b, i, em, strong, code, pre, br, p, ul, ol, li,
 * h1-h3, a with safe href only).
 *
 * Removes:
 * 1. <script> tags and their content
 * 2. on* event handler attributes (onclick, onload, onerror, ...)
 * 3. javascript:, vbscript:, and data:text/html URLs in href/src
 * 4. <iframe>, <object>, <embed>, <applet>, <link>, <meta>, <base>, <form>,
 *    <input>, <button>, <textarea>, <svg> tags
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let out = html;

  // 1. Remove <script>...</script> and <style>...</style> entirely (with content).
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");

  // 4. Remove dangerous tags entirely (open + close + self-closing).
  //    Also removes their content for container-style tags.
  const dangerousTags =
    "iframe|object|embed|applet|link|meta|base|form|input|button|textarea|svg|frame|frameset|noscript";
  out = out.replace(
    new RegExp(`<(${dangerousTags})\\b[^>]*>[\\s\\S]*?</\\1\\s*>`, "gi"),
    ""
  );
  out = out.replace(new RegExp(`</?(${dangerousTags})\\b[^>]*>`, "gi"), "");

  // 2. Remove on* event handler attributes (onclick, onload, onerror, ...).
  //    Handles double-quoted, single-quoted, and unquoted attribute values.
  out = out.replace(/\son[a-zA-Z]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-zA-Z]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son[a-zA-Z]+\s*=\s*[^\s>]+/gi, "");

  // 3. Remove javascript:, vbscript:, and data:text/html URLs from href/src/xlink:href.
  out = out.replace(
    /((?:href|src|xlink:href)\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/gi,
    (match, prefix: string, value: string) => {
      const stripped = value.replace(/^["']|["']$/g, "").trim();
      if (
        /^\s*javascript:/i.test(stripped) ||
        /^\s*vbscript:/i.test(stripped) ||
        /^\s*data:text\/html/i.test(stripped)
      ) {
        return "";
      }
      return match;
    }
  );

  return out;
}
