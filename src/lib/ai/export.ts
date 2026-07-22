import katex from "katex";
import { prepareAIContentForRendering } from "@/lib/ai/content";

type PreparedAcademicExport = { source: string; restore: (html: string) => string };

export function prepareAcademicMarkdownForExport(content: string): PreparedAcademicExport {
  const code: string[] = [];
  const protectedSource = content.replace(/```[\s\S]*?```|`[^`\n]*`/g, (value) => {
    const token = `SCHOLARCODETOKEN${code.length}END`;
    code.push(value);
    return token;
  });
  const math: string[] = [];
  let source = prepareAIContentForRendering(protectedSource)
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, expression: string) => {
      const token = `SCHOLARMATHTOKEN${math.length}END`;
      math.push(renderMath(expression, true));
      return `\n${token}\n`;
    })
    .replace(/(^|[^\\])\$([^$\n]+?)\$/g, (_, prefix: string, expression: string) => {
      const token = `SCHOLARMATHTOKEN${math.length}END`;
      math.push(renderMath(expression, false));
      return `${prefix}${token}`;
    });
  source = source.replace(/SCHOLARCODETOKEN(\d+)END/g, (_, index: string) => code[Number(index)] ?? "");
  return {
    source,
    restore: (html) => html.replace(/SCHOLARMATHTOKEN(\d+)END/g, (_, index: string) => math[Number(index)] ?? ""),
  };
}

export function renderAcademicTextToHtml(content: string): string {
  const prepared = prepareAcademicMarkdownForExport(content);
  const escaped = prepared.source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  return prepared.restore(escaped);
}

export async function renderAcademicFormulaToPng(content: string, color = "#111827"): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const expression = content.trim()
    .replace(/^\$\$|\$\$$/g, "")
    .replace(/^\\\[|\\\]$/g, "")
    .replace(/^\\\(|\\\)$/g, "")
    .replace(/^\$|\$$/g, "")
    .trim();
  try {
    const mathml = katex.renderToString(expression, { displayMode: true, throwOnError: false, strict: false, output: "mathml" });
    const width = 1800;
    const height = 300;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:${color};font-size:64px;background:transparent">${mathml}</div></foreignObject></svg>`;
    const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const value = new Image();
        value.onload = () => resolve(value);
        value.onerror = reject;
        value.src = blobUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    return null;
  }
}

function renderMath(expression: string, displayMode: boolean) {
  try {
    return katex.renderToString(expression.trim(), { displayMode, throwOnError: false, strict: false, output: "htmlAndMathml" });
  } catch {
    const safe = expression.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<span class="scholar-math-fallback" aria-label="${safe}">${safe}</span>`;
  }
}
