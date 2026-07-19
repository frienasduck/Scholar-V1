"use client";

import { cn, sanitizeHtml } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "#6366f1",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <Card className={cn("premium-card premium-card-hover p-4 overflow-hidden relative", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums leading-tight">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div
          className="grid place-items-center h-9 w-9 rounded-xl shrink-0"
          style={{ background: `${accent}1a`, color: accent }}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </Card>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="grid place-items-center h-14 w-14 rounded-2xl bg-muted mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pill({
  children,
  active,
  onClick,
  color,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
        active ? "text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/70"
      )}
      style={active && color ? { background: color } : undefined}
    >
      {children}
    </button>
  );
}

export function ProgressRing({
  value,
  size = 60,
  stroke = 6,
  color = "#6366f1",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: ReactNode;
}) {
  // Defensive numeric coercion — prevents "Received NaN for strokeDashoffset" warnings
  // when callers pass undefined / non-numeric values (e.g. achievements with target=0
  // or migrated profile data with missing fields).
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue)
    ? Math.min(100, Math.max(0, numericValue))
    : 0;

  const numericSize = Number(size);
  const safeSize = Number.isFinite(numericSize) && numericSize > 0 ? numericSize : 60;

  const numericStroke = Number(stroke);
  const safeStroke = Number.isFinite(numericStroke) && numericStroke > 0 ? numericStroke : 6;

  const safeRadius = Math.max(0.5, (safeSize - safeStroke) / 2);
  const circumference = 2 * Math.PI * safeRadius;
  const strokeDashoffset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="relative grid place-items-center" style={{ width: safeSize, height: safeSize }}>
      <svg width={safeSize} height={safeSize} className="-rotate-90">
        <circle cx={safeSize / 2} cy={safeSize / 2} r={safeRadius} fill="none" stroke="currentColor" strokeWidth={safeStroke} className="text-muted" />
        <circle
          cx={safeSize / 2}
          cy={safeSize / 2}
          r={safeRadius}
          fill="none"
          stroke={color}
          strokeWidth={safeStroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">
        {label ?? `${Math.round(safeValue)}%`}
      </div>
    </div>
  );
}

// Lightweight markdown renderer (handles headings, bold, italic, code, lists, blockquote, tables).
export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const out: ReactNode[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let table: string[][] | null = null;
  const flushList = () => {
    if (!list) return;
    if (list.type === "ul") {
      out.push(
        <ul key={out.length} className="list-disc pl-5 my-2 space-y-1 text-sm">
          {list.items.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(it) }} />)}
        </ul>
      );
    } else {
      out.push(
        <ol key={out.length} className="list-decimal pl-5 my-2 space-y-1 text-sm">
          {list.items.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(it) }} />)}
        </ol>
      );
    }
    list = null;
  };
  const flushTable = () => {
    if (!table) return;
    out.push(
      <div key={out.length} className="my-3 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>{table[0].map((h, i) => <th key={i} className="border border-border px-3 py-1.5 bg-muted text-left" dangerouslySetInnerHTML={{ __html: inline(h) }} />)}</tr>
          </thead>
          <tbody>
            {table.slice(2).map((row, ri) => (
              <tr key={ri}>
                {row.map((c, ci) => <td key={ci} className="border border-border px-3 py-1.5" dangerouslySetInnerHTML={{ __html: inline(c) }} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    table = null;
  };
  for (const raw of lines) {
    const line = raw;
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList();
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (!table) table = [];
      table.push(cells);
      continue;
    }
    if (table) flushTable();
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushList();
      const lvl = h[1].length;
      const cls = lvl <= 1 ? "text-2xl font-semibold mt-5 mb-2" : lvl === 2 ? "text-xl font-semibold mt-4 mb-2" : "text-base font-semibold mt-3 mb-1";
      out.push(<p key={out.length} className={cls} dangerouslySetInnerHTML={{ __html: inline(h[2]) }} />);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
      list.items.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
      list.items.push(line.replace(/^\s*\d+\.\s+/, ""));
      continue;
    }
    flushList();
    if (line.startsWith(">")) {
      out.push(<blockquote key={out.length} className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground my-2 text-sm" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^>\s?/, "")) }} />);
      continue;
    }
    if (line.trim() === "") { out.push(<div key={out.length} className="h-2" />); continue; }
    if (line.trim().startsWith("```")) {
      const code = line.trim().slice(3);
      out.push(<pre key={out.length} className="my-2 p-3 rounded-lg bg-muted overflow-x-auto text-xs font-mono"><code>{code}</code></pre>);
      continue;
    }
    out.push(<p key={out.length} className="text-sm my-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: inline(line) }} />);
  }
  flushList();
  flushTable();
  return <div className="prose-neha">{out}</div>;
}

function inline(s: string): string {
  // Sanitize the assembled HTML so any `javascript:` URLs produced by the
  // markdown link rule are stripped before reaching dangerouslySetInnerHTML.
  return sanitizeHtml(
    s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, '<code class="font-mono text-[0.85em] px-1 py-0.5 rounded bg-muted">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline">$1</a>')
  );
}
