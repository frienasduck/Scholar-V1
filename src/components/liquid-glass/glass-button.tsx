"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ScholarGlass } from "./scholar-glass";
import { glassMaterial, type GlassMaterialId } from "./glass-tokens";

export type GlassButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "premium"
  | "danger"
  | "icon"
  | "compact";

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: GlassButtonVariant;
  size?: "sm" | "md" | "lg";
  /** Force true liquid glass on/off. Defaults follow the button's importance. */
  trueGlass?: boolean;
}

/** Important actions get refraction; repeated UI stays on the cheap material. */
const VARIANT_TIER1: Record<GlassButtonVariant, boolean> = {
  primary: true,
  secondary: false,
  ghost: false,
  premium: true,
  danger: false,
  icon: false,
  compact: false,
};

const VARIANT_MATERIAL: Record<GlassButtonVariant, GlassMaterialId> = {
  primary: "control",
  secondary: "control",
  ghost: "subtle",
  premium: "premium",
  danger: "control",
  icon: "control",
  compact: "subtle",
};

const SIZE_PADDING: Record<NonNullable<GlassButtonProps["size"]>, string> = {
  sm: "0.42rem 0.72rem",
  md: "0.56rem 0.95rem",
  lg: "0.72rem 1.25rem",
};

/**
 * Scholar's shared button family.
 *
 * Press response is a restrained physical compression (`--sg-press`), the edge
 * and specular layers shift on hover, and the material never bounces. Buttons
 * that matter use Tier 1 refraction; everything else uses the lightweight
 * material so a toolbar with ten buttons is still cheap.
 */
export function GlassButton({
  children,
  variant = "secondary",
  size = "md",
  trueGlass,
  className,
  style,
  ...rest
}: GlassButtonProps) {
  const tier1 = trueGlass ?? VARIANT_TIER1[variant];
  const materialId = VARIANT_MATERIAL[variant];
  const material = glassMaterial(materialId);
  const isIcon = variant === "icon";

  return (
    <ScholarGlass
      as="button"
      variant={materialId}
      refraction={tier1 ? "auto" : "none"}
      interactive
      className={cn(
        "sg-button",
        isIcon && "sg-button--icon",
        variant === "premium" && "sg-button--premium",
        variant === "danger" && "sg-button--danger",
        variant === "ghost" && "sg-button--ghost",
        className,
      )}
      data-sg-size={isIcon ? "icon" : variant === "compact" ? "sm" : size}
      innerClassName="sg-button__inner"
      style={{ ...style, "--sg-action-material": material.id } as React.CSSProperties}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </ScholarGlass>
  );
}

/** Inline style helper so callers can match a button's padding without guessing. */
export function glassButtonPadding(size: NonNullable<GlassButtonProps["size"]>): string {
  return SIZE_PADDING[size];
}
