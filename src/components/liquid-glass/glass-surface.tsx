"use client";

import type { CSSProperties, ElementType, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { glassMaterial, glassVars, type GlassMaterialId } from "./glass-tokens";

export interface GlassSurfaceProps {
  children?: ReactNode;
  /** Tier 2 material family. Tier 1 families fall back to their static recipe. */
  material?: GlassMaterialId;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  radius?: number | string;
  substrate?: "auto" | "dark" | "light";
  ref?: Ref<HTMLElement>;
  [key: string]: unknown;
}

/**
 * Tier 2 — optimized static glass.
 *
 * Same optical family as `ScholarGlass` (layered light, edge highlight, blurred
 * backdrop) without a displacement filter, a pointer registration or any
 * per-surface script. This is what the bulk of Scholar's panels, cards and
 * containers should use.
 */
export function GlassSurface({
  children,
  material = "standard",
  as,
  className,
  style,
  radius,
  substrate = "auto",
  ref,
  ...rest
}: GlassSurfaceProps) {
  const token = glassMaterial(material);
  const Component = (as ?? "div") as ElementType;

  return (
    <Component
      {...rest}
      ref={ref}
      data-sg-surface={token.id}
      data-sg-substrate={substrate === "auto" ? undefined : substrate}
      className={cn(token.className, className)}
      style={{ ...glassVars(token, radius), ...style }}
    >
      {children}
    </Component>
  );
}
