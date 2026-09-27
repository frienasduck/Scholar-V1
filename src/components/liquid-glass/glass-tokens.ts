/**
 * Scholar Liquid Glass — material tokens.
 *
 * One material system, three tiers:
 *   Tier 1 — true refractive glass (shared SVG displacement filters)
 *   Tier 2 — optimized static glass (backdrop-filter + layered light)
 *   Tier 3 — accessibility/fallback material (no refraction dependency)
 *
 * These tokens are the single source of truth for the design system. Components
 * consume them; nothing in Scholar should hardcode its own blur/opacity/light
 * recipe. CSS mirrors these values in `liquid-glass.css` so server-rendered
 * markup and client components stay visually identical.
 */

export type GlassTier = 1 | 2 | 3;

export type GlassMaterialId =
  | "subtle"
  | "standard"
  | "elevated"
  | "prominent"
  | "control"
  | "menu"
  | "modal"
  | "notification"
  | "navigation"
  | "premium";

/** Refraction presets, mirrored by the shared filters in the glass provider. */
export type GlassRefraction = "none" | "subtle" | "standard" | "prominent";

export interface GlassMaterial {
  id: GlassMaterialId;
  tier: GlassTier;
  /** Corner radius token name (`--sg-radius-*`) resolved in CSS. */
  radius: string;
  /** Backdrop blur in CSS pixels. */
  blur: number;
  /** Backdrop saturation, percent. */
  saturation: number;
  /** Backdrop brightness multiplier. */
  brightness: number;
  /** Plate opacity (0–1) before gradient overlays. */
  fill: number;
  /** Edge highlight strength (0–1). */
  edge: number;
  /** Specular sweep strength (0–1). */
  specular: number;
  /** Displacement scale handed to the shared SVG filter (Tier 1 only). */
  displacement: number;
  /** Chromatic aberration intensity for the shared SVG filter. */
  aberration: number;
  /** Cursor attraction (0 = rigid). */
  elasticity: number;
  /** Refraction preset used by Tier 1 surfaces. */
  refraction: GlassRefraction;
  /** CSS utility class that carries the static material. */
  className: string;
}

const MATERIALS: Record<GlassMaterialId, GlassMaterial> = {
  /* ── Tier 2: quiet, repeated, large surfaces ─────────────────────────── */
  subtle: {
    id: "subtle", tier: 2, radius: "var(--sg-radius-card)", blur: 14, saturation: 128, brightness: 0.94,
    fill: 0.05, edge: 0.34, specular: 0.4, displacement: 0, aberration: 0, elasticity: 0,
    refraction: "none", className: "sg-material sg-material--subtle",
  },
  standard: {
    id: "standard", tier: 2, radius: "var(--sg-radius-card)", blur: 20, saturation: 140, brightness: 0.97,
    fill: 0.07, edge: 0.5, specular: 0.6, displacement: 0, aberration: 0, elasticity: 0,
    refraction: "none", className: "sg-material sg-material--standard",
  },
  elevated: {
    id: "elevated", tier: 2, radius: "var(--sg-radius-panel)", blur: 26, saturation: 148, brightness: 0.98,
    fill: 0.085, edge: 0.62, specular: 0.72, displacement: 0, aberration: 0, elasticity: 0,
    refraction: "none", className: "sg-material sg-material--elevated",
  },

  /* ── Tier 1: true liquid glass, used sparingly ───────────────────────── */
  prominent: {
    id: "prominent", tier: 1, radius: "var(--sg-radius-panel)", blur: 22, saturation: 152, brightness: 0.98,
    fill: 0.075, edge: 0.85, specular: 0.9, displacement: 46, aberration: 1.6, elasticity: 0.085,
    refraction: "prominent", className: "sg-material sg-material--prominent",
  },
  control: {
    id: "control", tier: 1, radius: "var(--sg-radius-pill)", blur: 16, saturation: 146, brightness: 0.98,
    fill: 0.06, edge: 0.7, specular: 0.78, displacement: 30, aberration: 1.2, elasticity: 0.07,
    refraction: "standard", className: "sg-material sg-material--control",
  },
  menu: {
    id: "menu", tier: 1, radius: "var(--sg-radius-menu)", blur: 30, saturation: 150, brightness: 0.96,
    fill: 0.1, edge: 0.72, specular: 0.55, displacement: 26, aberration: 1.1, elasticity: 0.05,
    refraction: "subtle", className: "sg-material sg-material--menu",
  },
  navigation: {
    id: "navigation", tier: 1, radius: "var(--sg-radius-pill)", blur: 24, saturation: 152, brightness: 0.95,
    fill: 0.085, edge: 0.8, specular: 0.82, displacement: 38, aberration: 1.4, elasticity: 0.075,
    refraction: "standard", className: "sg-material sg-material--navigation",
  },

  /* ── Tier 2, high-opacity: text and form density wins over effect ────── */
  modal: {
    id: "modal", tier: 2, radius: "var(--sg-radius-dialog)", blur: 30, saturation: 142, brightness: 1,
    fill: 0.16, edge: 0.7, specular: 0.5, displacement: 0, aberration: 0, elasticity: 0,
    refraction: "none", className: "sg-material sg-material--modal",
  },
  notification: {
    id: "notification", tier: 2, radius: "var(--sg-radius-dialog)", blur: 26, saturation: 146, brightness: 0.98,
    fill: 0.13, edge: 0.76, specular: 0.72, displacement: 0, aberration: 0, elasticity: 0,
    refraction: "none", className: "sg-material sg-material--notification",
  },
  premium: {
    id: "premium", tier: 1, radius: "var(--sg-radius-panel)", blur: 24, saturation: 158, brightness: 0.99,
    fill: 0.08, edge: 0.9, specular: 0.95, displacement: 44, aberration: 1.8, elasticity: 0.09,
    refraction: "prominent", className: "sg-material sg-material--premium",
  },
};

export const GLASS_MATERIALS = MATERIALS;

export function glassMaterial(id: GlassMaterialId = "standard"): GlassMaterial {
  return MATERIALS[id] ?? MATERIALS.standard;
}

/** CSS custom properties consumed by `liquid-glass.css`. */
export interface GlassVars {
  "--sg-blur": string;
  "--sg-sat": string;
  "--sg-bright": string;
  "--sg-fill": string;
  "--sg-edge": string;
  "--sg-spec": string;
  "--sg-radius": string;
}

export function glassVars(material: GlassMaterial, radiusOverride?: string | number): GlassVars {
  return {
    "--sg-blur": `${material.blur}px`,
    "--sg-sat": `${material.saturation}%`,
    "--sg-bright": String(material.brightness),
    "--sg-fill": String(material.fill),
    "--sg-edge": String(material.edge),
    "--sg-spec": String(material.specular),
    "--sg-radius": radiusOverride === undefined
      ? material.radius
      : typeof radiusOverride === "number" ? `${radiusOverride}px` : radiusOverride,
  };
}

/** Corner radius hierarchy — keeps Scholar from becoming one giant pill. */
export const GLASS_RADIUS = {
  control: "12px",
  pill: "999px",
  menu: "18px",
  card: "20px",
  panel: "26px",
  dialog: "28px",
} as const;

/** Tier 1 surfaces are capped so Scholar never ships dozens of refraction layers. */
export const GLASS_PERFORMANCE_BUDGET = {
  /** Maximum Tier 1 surfaces expected on screen at once. */
  maxTier1Surfaces: 6,
  /** Refraction is desktop/pointer-driven only. */
  refractionRequiresFinePointer: true,
  /** Pointer attraction magnitude cap in CSS pixels. */
  maxPullPx: 9,
} as const;
