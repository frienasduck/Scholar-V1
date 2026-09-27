"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import { glassMaterial, glassVars, type GlassMaterialId, type GlassRefraction } from "./glass-tokens";
import { registerGlassSurface } from "./glass-runtime";

export interface ScholarGlassProps {
  children?: ReactNode;
  /** Material family. Tier 1 families opt into refraction automatically. */
  variant?: GlassMaterialId;
  /** Override the refraction preset, or "none" to keep the material static. */
  refraction?: GlassRefraction | "auto";
  /** Corner radius override in px or as a CSS length. */
  radius?: number | string;
  /** Enables cursor attraction plus hover/press response. */
  interactive?: boolean;
  /** Renders as a block-level surface instead of an inline control. */
  block?: boolean;
  /** Hides overflow (default) — opt out for surfaces that anchor children. */
  overflowVisible?: boolean;
  /** Lets a surface declare the substrate it sits on (brighter media areas). */
  substrate?: "auto" | "dark" | "light";
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  innerClassName?: string;
  ref?: Ref<HTMLElement>;
  [key: string]: unknown;
}

/**
 * Tier 1 — true interactive liquid glass.
 *
 * Use for a small number of visually important surfaces: the main floating
 * navigation, active tab pills, menus, notification surfaces, premium CTAs and
 * the LAM composer shell. Repeated or large surfaces should use `GlassSurface`
 * (Tier 2) so Scholar never runs dozens of refraction layers at once.
 *
 * Interaction is entirely CSS driven (`:hover` / `:active` / custom properties),
 * so moving the pointer over a glass control never triggers a React render.
 */
export function ScholarGlass({
  children,
  variant = "control",
  refraction = "auto",
  radius,
  interactive = false,
  block = false,
  overflowVisible = false,
  substrate = "auto",
  as,
  className,
  style: styleProp,
  innerClassName,
  ref: forwardedRef,
  ...rest
}: ScholarGlassProps) {
  const material = glassMaterial(variant);
  const localRef = useRef<HTMLElement | null>(null);
  const resolvedElement = as ?? "div";
  const Component = resolvedElement as ElementType;
  // Keep the wrapper valid for inline and interactive elements. A `<div>`
  // inside a `<span>`, `<button>` or `<a>` is invalid HTML and can make React
  // repair the tree differently during hydration.
  const ContentTag = (
    resolvedElement === "span" || resolvedElement === "button" || resolvedElement === "a"
      ? "span"
      : "div"
  ) as ElementType;

  const preset: GlassRefraction = refraction === "auto" ? material.refraction : refraction;

  useEffect(() => {
    if (!interactive || preset === "none") return;
    const element = localRef.current;
    if (!element) return;
    // One shared runtime for the whole product: this registers the node, it does
    // not create a listener of its own.
    return registerGlassSurface(element, { elasticity: material.elasticity });
  }, [interactive, preset, material.elasticity]);

  return (
    <Component
      {...rest}
      ref={(node: HTMLElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef && typeof forwardedRef === "object") {
          (forwardedRef as { current: HTMLElement | null }).current = node;
        }
      }}
      data-sg-glass="true"
      data-sg-variant={material.id}
      data-sg-refraction={preset === "none" ? undefined : preset}
      data-sg-interactive={interactive ? "true" : undefined}
      data-sg-substrate={substrate === "auto" ? undefined : substrate}
      data-sg-block={block ? "true" : undefined}
      data-sg-overflow={overflowVisible ? "visible" : undefined}
      className={cn("sg-glass", `sg-glass--${material.id}`, className)}
      style={{ ...glassVars(material, radius), ...styleProp }}
    >
      <span className="sg-layer sg-warp" aria-hidden="true" />
      <span className="sg-layer sg-film" aria-hidden="true" />
      <span className="sg-layer sg-specular" aria-hidden="true" />
      <span className="sg-layer sg-chroma" aria-hidden="true" />
      <span className="sg-edge" aria-hidden="true" />
      <ContentTag className={cn("sg-content", innerClassName)}>{children}</ContentTag>
    </Component>
  );
}
