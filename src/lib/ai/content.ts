const TOKEN_PREFIX = "\uE000SCHOLAR_CODE_";

function protectCode(content: string) {
  const blocks: string[] = [];
  const text = content.replace(/```[\s\S]*?```|`[^`\n]*`/g, (value) => {
    const token = `${TOKEN_PREFIX}${blocks.length}\uE001`;
    blocks.push(value);
    return token;
  });
  return { text, blocks };
}

function restoreCode(content: string, blocks: string[]) {
  return content.replace(new RegExp(`${TOKEN_PREFIX}(\\d+)\\uE001`, "g"), (_, index: string) => blocks[Number(index)] ?? "");
}

function normalizeLatexDelimiters(content: string) {
  const withDelims = content
    // Restore control-escaped TeX commands caused by single-backslash JSON emission (\f->\x0c, \t->\x09, \b->\x08).
    .replace(/\u000c(?=(?:rac|orall)\b)/g, "\\f")
    .replace(/\u0009(?=(?:heta|imes|ext|o\b|au|an)\b)/g, "\\t")
    .replace(/\u0008(?=(?:eta|inom|ar)\b)/g, "\\b")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expression: string) => `\n$$\n${expression.trim()}\n$$\n`)
    .replace(/\\\(([^\n]*?)\\\)/g, (_, expression: string) => `$${expression.trim()}$`)
    .replace(/(^|[^\\])\b(vec|mathrm|mathbf|mathcal|frac|dfrac|sqrt|text)\{/g, "$1\\$2{")
    .replace(/\^\s*circ\b/g, "^\\circ")
    .replace(/(\d)\s*,mathrm([A-Za-z]+)/g, "$1\\,\\mathrm{$2}");

  // Fix dropped backslashes inside delimited math & convert parenthesized/bracketed TeX macros outside math blocks.
  return withDelims
    .split(/(\$\$[\s\S]*?\$\$|(?<!\\)\$(?:\\.|[^$\n])*?(?<!\\)\$)/g)
    .map((part, index) =>
      index % 2 === 1
        ? part.replace(/(^|[^\\])\b(cdot|vec|cos|sin|tan)\b/g, "$1\\$2")
        : part
            .replace(
              /\(([^()\n]*(?:\\(?:vec|frac|dfrac|mathrm|mathbf|mathcal|sin|cos|tan|theta|alpha|beta|gamma|omega|Delta|cdot|times|sqrt))[^()\n]*)\)/g,
              (_, inner: string) => `$${inner.trim().replace(/\\+$/, "")}$`,
            )
            .replace(
              /\[\s*([^[\]\n]*(?:\\(?:vec|frac|dfrac|mathrm|mathbf|mathcal|text))[^[\]\n]*)\s*\](?!\()/g,
              (_, inner: string) => `\n$$\n${inner.trim()}\n$$\n`,
            ),
    )
    .join("");
}

function normalizeCollapsedTables(content: string): string {
  return content
    .split("\n")
    .map((line) => (/\|[\s:-]{2,}\|/.test(line) && /\|\s*\|/.test(line) ? line.replace(/\|\s*\|/g, "|\n|") : line))
    .join("\n");
}

function normalizeLegacyAcademicMath(content: string) {
  const lines = content.split("\n");
  return lines.map((line) => {
    if (!/[=^]|10\^\(-?\d+\)/.test(line)) return line;
    if (/https?:\/\/|\[[^\]]+\]\([^)]+\)|\b(?:const|let|var|function|class|import|export)\b/.test(line)) return line;
    const trimmed = line.trim();
    if (!/=/.test(trimmed)) return line;
    const plainWords = trimmed
      .replace(/\b(?:sin|cos|tan|cot|sec|csc|log|ln|lim|sqrt|exp|mod|max|min)\b/gi, "")
      .match(/\b[A-Za-z]{3,}\b/g) ?? [];
    if (plainWords.length >= 4) return line;
    const signals = trimmed.match(/10\^|[_^]|[×·]|\/(?!\/)|\b(?:sin|cos|tan|lim|sqrt|log)\b/gi) ?? [];
    if (signals.length < 2 || trimmed.length > 500 || /[$<>`]/.test(trimmed)) return line;
    const latex = trimmed
      .replace(/10\^\((-?\d+)\)/g, "10^{$1}")
      .replace(/([A-Za-z])_([A-Za-z0-9]+)/g, "$1_{$2}")
      .replace(/([A-Za-z0-9)}])\^(-?\d+)/g, "$1^{$2}")
      .replace(/\s+[x×]\s+(?=10\^)/g, " \\times ")
      .replace(/\s+·\s+/g, " \\cdot ");
    return `$$\n${latex}\n$$`;
  }).join("\n");
}

/** Prepares trusted text syntax only. It never creates or accepts executable HTML. */
export function prepareAIContentForRendering(content: string, legacy = true): string {
  const normalizedNewlines = String(content ?? "")
    .replace(/\\n(?![a-zA-Z])/g, "\n")
    .replace(/\r\n?/g, "\n");
  const protectedContent = protectCode(normalizedNewlines);
  let prepared = normalizeCollapsedTables(normalizeLatexDelimiters(protectedContent.text));
  // Explicit math is already delimited. Running the legacy line heuristic
  // inside it adds nested $$ fences and exposes otherwise valid LaTeX as text.
  if (legacy) prepared = prepared.split(/(\$\$[\s\S]*?\$\$|(?<!\\)\$(?:\\.|[^$\n])*?(?<!\\)\$)/g)
    .map((part, index) => index % 2 ? part : normalizeLegacyAcademicMath(part)).join("");
  return restoreCode(prepared, protectedContent.blocks);
}

export function hasIncompleteMath(content: string): boolean {
  const { text } = protectCode(content);
  const displayCount = (text.match(/\$\$/g) ?? []).length;
  const inlineCount = (text.replace(/\$\$/g, "").match(/(^|[^\\])\$/g) ?? []).length;
  const bracketOpen = (text.match(/\\\[/g) ?? []).length;
  const bracketClose = (text.match(/\\\]/g) ?? []).length;
  const parenOpen = (text.match(/\\\(/g) ?? []).length;
  const parenClose = (text.match(/\\\)/g) ?? []).length;
  return displayCount % 2 !== 0 || inlineCount % 2 !== 0 || bracketOpen !== bracketClose || parenOpen !== parenClose;
}
