"use client";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Dialog material.
 *
 * Scholar dialogs keep a strongly tinted plate (Tier 2 `modal` material) rather
 * than refraction: long forms and dense text must stay crisp, and the page
 * behind a dialog must not be blurred twice. The overlay only dims.
 */
export function GlassDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return <DialogContent data-glass-dialog="true" className={cn("sg-dialog", className)} {...props} />;
}

export function GlassSheetContent({
  className,
  ...props
}: React.ComponentProps<typeof SheetContent>) {
  return <SheetContent data-glass-dialog="sheet" className={cn("sg-dialog sg-dialog--sheet", className)} {...props} />;
}

export {
  Dialog as GlassDialog,
  DialogClose as GlassDialogClose,
  DialogDescription as GlassDialogDescription,
  DialogFooter as GlassDialogFooter,
  DialogHeader as GlassDialogHeader,
  DialogTitle as GlassDialogTitle,
  DialogTrigger as GlassDialogTrigger,
  Sheet as GlassSheet,
  SheetDescription as GlassSheetDescription,
  SheetHeader as GlassSheetHeader,
  SheetTitle as GlassSheetTitle,
};

export const GLASS_DIALOG_BODY_CLASS = "sg-dialog__body";
export const GLASS_DIALOG_FOOTER_CLASS = "sg-dialog__footer";
