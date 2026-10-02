type Node = { tag: string; children: (Node | string)[] };
/** Text-only MathML conversion. No DOM, HTML execution, remote images or macros. */
export function mathmlToTex(markup: string) {
  const root: Node = { tag: "root", children: [] }; const stack = [root];
  if (markup.length > 100_000) return "";
  for (const token of markup.match(/<[^>]*>|[^<]+/g) ?? []) {
    if (token.startsWith("</")) { if (stack.length > 1) stack.pop(); }
    else if (token.startsWith("<")) {
      const tag = token.match(/^<([\w:-]+)/)?.[1]?.toLowerCase(); if (!tag) continue;
      const node: Node = { tag, children: [] }; stack.at(-1)!.children.push(node);
      if (!token.endsWith("/>")) { if (stack.length > 64) return ""; stack.push(node); }
    } else stack.at(-1)!.children.push(token);
  }
  const symbols: Record<string, string> = { "→": "\\rightarrow ", "≤": "\\le ", "≥": "\\ge ", "×": "\\times ", "⋅": "\\cdot ", "∞": "\\infty ", "∑": "\\sum ", "∫": "\\int ", "±": "\\pm ", "−": "-", "<": "\\lt ", ">": "\\gt ", "$": "\\$" };
  function render(node: Node | string): string {
    if (typeof node === "string") return node.replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_m, hex, dec) => { const n = parseInt(hex ?? dec, hex ? 16 : 10); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; }).replace(/&(amp|lt|gt|quot|nbsp);/g, (_m, k) => ({ amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " " }[k as "amp"])).replace(/[→≤≥×⋅∞∑∫±−<>$]/g, c => symbols[c]);
    if (["annotation", "annotation-xml", "script", "style"].includes(node.tag)) return "";
    const parts = node.children.map(render); const [a = "", b = "", c = ""] = parts;
    if (node.tag === "mfrac") return `\\frac{${a}}{${b}}`;
    if (node.tag === "msub") return `{${a}}_{${b}}`;
    if (node.tag === "msup") return `{${a}}^{${b}}`;
    if (node.tag === "msubsup") return `{${a}}_{${b}}^{${c}}`;
    if (node.tag === "msqrt") return `\\sqrt{${parts.join("")}}`;
    if (node.tag === "mroot") return `\\sqrt[${b}]{${a}}`;
    if (node.tag === "mover") return b.includes("\\rightarrow") ? `\\vec{${a}}` : `\\overset{${b}}{${a}}`;
    if (node.tag === "munder") return `\\underset{${b}}{${a}}`;
    if (node.tag === "munderover") return `\\underset{${b}}{\\overset{${c}}{${a}}}`;
    if (node.tag === "mtable") return `\\begin{matrix}${parts.join("\\\\")}\\end{matrix}`;
    if (node.tag === "mtr") return parts.join(" & ");
    if (node.tag === "mfenced") return `(${parts.join(",")})`;
    if (node.tag === "mtext") return `\\text{${parts.join("").replace(/[{}\\]/g, " ")}}`;
    return parts.join("");
  }
  return render(root).trim();
}
