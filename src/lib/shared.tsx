"use client";

import { cn } from "@/lib/utils";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
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

// Compatibility wrapper: every existing AI Markdown consumer now uses the
// universal safe Markdown + LaTeX renderer.
export function Markdown({ content }: { content: string }) {
  return <ScholarAIContent content={content} />;
}
