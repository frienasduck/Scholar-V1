"use client";

import type { CSSProperties, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared floating-glass menu material.
 *
 * Radix powered menus (dropdown, context menu, select, popover, menubar,
 * command palette) already pick this material up automatically through their
 * `data-slot` attributes — see `liquid-glass.css`. This panel is for feature
 * menus Scholar renders itself (LAM mode sheets, Nigtube controls, Study Music
 * menus, media controls) so they resolve to the exact same surface.
 *
 * Usage: position the panel yourself (absolute, fixed or inside a Radix
 * portal). The panel never clips children and owns its own stacking context.
 */
export interface GlassMenuPanelProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Elevation step inside the menu family. */
  level?: "menu" | "elevated";
  /** Keeps long menus scrollable without growing past the viewport. */
  scrollable?: boolean;
  label?: string;
  ref?: Ref<HTMLDivElement>;
}

export function GlassMenuPanel({
  children,
  className,
  style,
  level = "menu",
  scrollable = false,
  label,
  ref,
}: GlassMenuPanelProps) {
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      data-glass-menu={level}
      className={cn("sg-menu-panel", scrollable && "sg-menu-panel--scroll", className)}
      style={style}
    >
      {children}
    </div>
  );
}

/** One shared menu row so custom menus match Radix menus exactly. */
export function GlassMenuItem({
  children,
  className,
  active = false,
  ...rest
}: {
  children?: ReactNode;
  className?: string;
  active?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      role="menuitem"
      data-sg-menu-item="true"
      data-sg-active={active ? "true" : undefined}
      className={cn("sg-menu-item", className)}
    >
      {children}
    </button>
  );
}

export function GlassMenuSeparator() {
  return <div role="separator" className="sg-menu-separator" />;
}
