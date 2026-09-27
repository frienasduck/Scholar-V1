/**
 * Scholar Liquid Glass — the product's single material system.
 *
 *   <ScholarGlass variant="navigation">…</ScholarGlass>   Tier 1 (refractive)
 *   <GlassSurface material="standard">…</GlassSurface>    Tier 2 (static)
 *   <GlassButton variant="primary">…</GlassButton>        shared controls
 *   <GlassMenuPanel>…</GlassMenuPanel>                    custom floating menus
 *   <GlassDialogContent>…</GlassDialogContent>            dialogs & sheets
 *
 * Tier 3 (unsupported browsers, reduced transparency/motion, coarse pointers)
 * needs no component changes — the provider publishes capability flags on
 * `<html>` and `liquid-glass.css` degrades every surface in one place.
 */

export { ScholarGlassProvider, useGlassRuntime, detectGlassRuntime } from "./liquid-glass-provider";
export type { GlassMaterialMode, GlassMotionMode, GlassPointerMode, GlassRuntimeState } from "./liquid-glass-provider";

export { ScholarGlass } from "./scholar-glass";
export type { ScholarGlassProps } from "./scholar-glass";

export { GlassSurface } from "./glass-surface";
export type { GlassSurfaceProps } from "./glass-surface";

export { GlassButton, glassButtonPadding } from "./glass-button";
export type { GlassButtonProps, GlassButtonVariant } from "./glass-button";

export { GlassInput, GlassTextarea, GlassSearchField, GlassFieldShell } from "./glass-input";
export type { GlassSearchFieldProps } from "./glass-input";

export { GlassMenuPanel, GlassMenuItem, GlassMenuSeparator } from "./glass-menu";
export type { GlassMenuPanelProps } from "./glass-menu";

export {
  GlassDialog,
  GlassDialogClose,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogFooter,
  GlassDialogHeader,
  GlassDialogTitle,
  GlassDialogTrigger,
  GlassSheet,
  GlassSheetContent,
  GlassSheetDescription,
  GlassSheetHeader,
  GlassSheetTitle,
  GLASS_DIALOG_BODY_CLASS,
  GLASS_DIALOG_FOOTER_CLASS,
} from "./glass-dialog";

export { GLASS_NOTIFICATION_MATERIAL, GLASS_NOTIFICATION_TONE_COLOR, glassNotificationVars } from "./glass-notification";
export type { GlassNotificationTone } from "./glass-notification";

export { GLASS_MATERIALS, GLASS_RADIUS, GLASS_PERFORMANCE_BUDGET, glassMaterial, glassVars } from "./glass-tokens";
export type { GlassMaterial, GlassMaterialId, GlassRefraction, GlassTier } from "./glass-tokens";

export { glassRuntimeStats, isGlassPointerMotionAllowed, markGlassGeometryDirty } from "./glass-runtime";
