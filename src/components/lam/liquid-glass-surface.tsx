"use client";

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LiquidGlassSurface<T extends ElementType = "div">({
  as, children, className, depth = "floating", state = "idle", reduced = false, ...props
}: {
  as?: T;
  children: ReactNode;
  className?: string;
  depth?: "floating" | "embedded";
  state?: "idle" | "listening" | "thinking" | "answering" | "success" | "error";
  reduced?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">) {
  const Component = as ?? "div";
  return <Component {...props} className={cn("lam-liquid-glass", `lam-liquid-glass--${depth}`, `lam-liquid-glass--${state}`, reduced && "lam-liquid-glass--reduced", className)}><span className="lam-glass-reflection" aria-hidden="true" />{children}</Component>;
}
