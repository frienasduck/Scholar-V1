"use client";

import { memo, useMemo, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import { hasIncompleteMath, prepareAIContentForRendering } from "@/lib/ai/content";

export type ScholarAIContentMode = "full" | "compact" | "slide" | "transcript" | "print" | "editor";

type ScholarAIContentProps = {
  content: string;
  className?: string;
  mode?: ScholarAIContentMode;
  streaming?: boolean;
  normalizeLegacy?: boolean;
  style?: CSSProperties;
};

function safeUrl(url: string) {
  const value = url.trim().toLowerCase();
  return value.startsWith("https://") || value.startsWith("http://") || value.startsWith("mailto:") || value.startsWith("#") ? url : "";
}

export const ScholarAIContent = memo(function ScholarAIContent({
  content,
  className,
  mode = "full",
  streaming = false,
  normalizeLegacy = true,
  style,
}: ScholarAIContentProps) {
  const incomplete = streaming && hasIncompleteMath(content);
  const prepared = useMemo(
    () => incomplete ? content : prepareAIContentForRendering(content, normalizeLegacy),
    [content, incomplete, normalizeLegacy],
  );

  return (
    <div style={style} className={cn("scholar-ai-content", `scholar-ai-content--${mode}`, incomplete && "scholar-ai-content--streaming", className)}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={incomplete ? [] : [remarkMath]}
        rehypePlugins={incomplete ? [] : [[rehypeKatex, { throwOnError: false, strict: false, output: "htmlAndMathml" }]]}
        urlTransform={safeUrl}
        components={{
          a: ({ children, ...props }) => <a {...props} rel="noopener noreferrer" target="_blank">{children}</a>,
          pre: ({ children, ...props }) => <pre {...props} tabIndex={0}>{children}</pre>,
          code: ({ children, className, ...props }) => className
            ? <code {...props} className={className}>{String(children).replace(/\n$/, "").split("\n").map((line, index) => <span className="scholar-code-line" key={`${index}-${line.slice(0, 16)}`}>{line || " "}</span>)}</code>
            : <code {...props}>{children}</code>,
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
});
