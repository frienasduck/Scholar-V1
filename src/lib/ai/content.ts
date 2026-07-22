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
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expression: string) => `\n$$\n${expression.trim()}\n$$\n`)
    .replace(/\\\(([^\n]*?)\\\)/g, (_, expression: string) => `$${expression.trim()}$`);
}

function normalizeLegacyAcademicMath(content: string) {
  const lines = content.split("\n");
  return lines.map((line) => {
    if (!/[=^]|10\^\(-?\d+\)/.test(line)) return line;
    if (/https?:\/\/|\[[^\]]+\]\([^)]+\)|\b(?:const|let|var|function|class|import|export)\b/.test(line)) return line;
    const trimmed = line.trim();
    if (!/=/.test(trimmed)) return line;
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
  const normalizedNewlines = String(content ?? "").replace(/\r\n?/g, "\n");
  const protectedContent = protectCode(normalizedNewlines);
  let prepared = normalizeLatexDelimiters(protectedContent.text);
  if (legacy) prepared = normalizeLegacyAcademicMath(prepared);
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
