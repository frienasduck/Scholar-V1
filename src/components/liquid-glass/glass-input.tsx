"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ScholarGlass } from "./scholar-glass";

/**
 * Glass form controls.
 *
 * Priority order: sharp text, visible caret, readable placeholder, *then*
 * material. The glass shell never uses refraction, so long typed content and
 * autofill styling can never be distorted.
 */
export function GlassInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn("sg-input", className)} data-sg-control="input" />;
}

export function GlassTextarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn("sg-textarea", className)} data-sg-control="textarea" />;
}

export interface GlassSearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  trailing?: ReactNode;
}

/**
 * Search / command field. The field itself stays a plain glass input so the
 * caret and text selection behave exactly like a native control; only the
 * container is a Tier 1 surface, and only when it is a focal control.
 */
export function GlassSearchField({
  icon,
  trailing,
  className,
  ...rest
}: GlassSearchFieldProps) {
  return (
    <ScholarGlass
      variant="control"
      refraction="none"
      interactive
      className={cn("sg-search", className)}
      innerClassName="sg-search__inner"
    >
      {icon ? <span className="sg-search__icon" aria-hidden="true">{icon}</span> : null}
      <input {...rest} className="sg-search__input" data-sg-control="search" />
      {trailing ? <span className="sg-search__trailing">{trailing}</span> : null}
    </ScholarGlass>
  );
}

/** Wraps any existing control in the shared glass shell without restyling it. */
export function GlassFieldShell({
  children,
  className,
  focusWithin = true,
}: {
  children: ReactNode;
  className?: string;
  focusWithin?: boolean;
}) {
  return (
    <div
      className={cn("sg-field-shell", focusWithin && "sg-field-shell--focus", className)}
      data-sg-control="shell"
    >
      {children}
    </div>
  );
}
