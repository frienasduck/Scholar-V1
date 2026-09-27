/**
 * Scholar Liquid Glass — shared refraction filter definitions.
 *
 * Rendered exactly once by `ScholarGlassProvider`. Every Tier 1 surface points
 * at one of these three filters by id instead of mounting its own SVG filter
 * tree, which is the single biggest optimisation over the reference
 * implementation (which builds a ~12-primitive `<svg>` per glass instance).
 *
 * Pipeline (chromatic edge refraction):
 *   1. two data-URI displacement maps (x in the red channel, y in the blue
 *      channel) are combined arithmetically into one 0.5-neutral field
 *   2. an edge mask is derived from that field so the centre of the surface
 *      stays perfectly sharp
 *   3. the red / green / blue channels are displaced by slightly different
 *      scales and recombined with screen blends → chromatic aberration
 *   4. the clean centre is composited back over the aberration
 *
 * The filter-chain design is adapted from the MIT-licensed
 * `liquid-glass-react` reference implementation (Copyright 2025 Max Rovensky);
 * the displacement field itself is generated here as an original, dependency
 * free inline SVG gradient — no canvas, no pre-baked binary asset.
 * See ./ATTRIBUTION.md.
 */

/** Displacement channel strength at the very edge, ramping to neutral at the centre. */
const EDGE_STOPS = [
  { offset: 0, value: 1 },
  { offset: 0.3, value: 0.843 },
  { offset: 0.66, value: 0.664 },
  { offset: 1, value: 0.5 },
];

function hex(value: number, channel: "r" | "b"): string {
  const byte = Math.max(0, Math.min(255, Math.round(value * 255)));
  if (channel === "r") return `#${byte.toString(16).padStart(2, "0")}0000`;
  return `#0000${byte.toString(16).padStart(2, "0")}`;
}

/**
 * Builds a 256×256 SVG image whose red (or blue) channel ramps from full at
 * both edges to neutral in the middle, so displacement is strongest exactly
 * where a real glass edge would bend light.
 */
function displacementAxis(channel: "r" | "b"): string {
  const forward = EDGE_STOPS.map((s) => `<stop offset="${s.offset}" stop-color="${hex(s.value, channel)}"/>`).join("");
  const reverse = EDGE_STOPS
    .map((s) => ({ offset: 1 - s.offset, value: s.value }))
    .reverse()
    .map((s) => `<stop offset="${s.offset}" stop-color="${hex(s.value, channel)}"/>`)
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">` +
    `<defs>` +
    `<linearGradient id="a" x1="0" y1="0" x2="1" y2="0">${forward}</linearGradient>` +
    `<linearGradient id="b" x1="0" y1="0" x2="1" y2="0">${reverse}</linearGradient>` +
    `</defs>` +
    `<rect width="128" height="256" fill="url(%23a)"/>` +
    `<rect x="128" width="128" height="256" fill="url(%23b)"/>` +
    `</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/%2523/g, "%23")}`;
}

let mapXCache: string | null = null;
let mapYCache: string | null = null;

export function displacementMapX(): string {
  if (!mapXCache) mapXCache = displacementAxis("r");
  return mapXCache;
}

/** The y field is the same ramp rotated: build it as a vertical gradient. */
export function displacementMapY(): string {
  if (mapYCache) return mapYCache;
  const forward = EDGE_STOPS.map((s) => `<stop offset="${s.offset}" stop-color="${hex(s.value, "b")}"/>`).join("");
  const reverse = EDGE_STOPS
    .map((s) => ({ offset: 1 - s.offset, value: s.value }))
    .reverse()
    .map((s) => `<stop offset="${s.offset}" stop-color="${hex(s.value, "b")}"/>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">` +
    `<defs>` +
    `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1">${forward}</linearGradient>` +
    `<linearGradient id="b" x1="0" y1="0" x2="0" y2="1">${reverse}</linearGradient>` +
    `</defs>` +
    `<rect width="256" height="128" fill="url(%23a)"/>` +
    `<rect y="128" width="256" height="128" fill="url(%23b)"/>` +
    `</svg>`;
  mapYCache = `data:image/svg+xml,${encodeURIComponent(svg).replace(/%2523/g, "%23")}`;
  return mapYCache;
}

export interface RefractionPreset {
  id: "subtle" | "standard" | "prominent";
  /** Displacement scale in px. Negative mirrors the reference's edge direction. */
  displacement: number;
  /** Chromatic separation intensity. */
  aberration: number;
}

export const REFRACTION_PRESETS: Record<RefractionPreset["id"], RefractionPreset> = {
  subtle: { id: "subtle", displacement: -24, aberration: 1 },
  standard: { id: "standard", displacement: -34, aberration: 1.4 },
  prominent: { id: "prominent", displacement: -48, aberration: 1.8 },
};

const CHANNEL_ROWS: string[][] = [
  ["1 0 0 0 0", "0 0 0 0 0", "0 0 0 0 0"],
  ["0 0 0 0 0", "0 1 0 0 0", "0 0 0 0 0"],
  ["0 0 0 0 0", "0 0 0 0 0", "0 0 1 0 0"],
];

function channelMatrix(source: string, result: string, channel: 0 | 1 | 2) {
  const rows = CHANNEL_ROWS[channel];
  return (
    <feColorMatrix
      in={source}
      type="matrix"
      values={`${rows[0]} ${rows[1]} ${rows[2]} 0 0 0 1 0`}
      result={result}
    />
  );
}

function RefractionFilter({ preset, suffix }: { preset: RefractionPreset; suffix: string }) {
  const { displacement, aberration } = preset;
  const blur = Math.max(0.1, 0.6 - aberration * 0.12);

  return (
    <filter
      id={`sg-refraction-${suffix}`}
      x="-30%"
      y="-30%"
      width="160%"
      height="160%"
      colorInterpolationFilters="sRGB"
    >
      {/* Displacement field: x in red, y in blue, neutral (0.5) at the centre. */}
      <feImage
        x="0"
        y="0"
        width="100%"
        height="100%"
        href={displacementMapX()}
        preserveAspectRatio="none"
        result="MAP_X"
      />
      <feImage
        x="0"
        y="0"
        width="100%"
        height="100%"
        href={displacementMapY()}
        preserveAspectRatio="none"
        result="MAP_Y"
      />
      <feComposite
        in="MAP_X"
        in2="MAP_Y"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="DISPLACEMENT_MAP"
      />

      {/* Edge mask: transparent through the middle, opaque at the borders. */}
      <feColorMatrix
        in="DISPLACEMENT_MAP"
        type="matrix"
        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0 0.6 0 -0.55"
        result="EDGE_INTENSITY"
      />
      <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
        <feFuncA type="linear" slope="2.6" intercept="-0.1" />
      </feComponentTransfer>

      {/* Undisplaced source, kept for the sharp centre. */}
      <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />

      {/* Per-channel displacement → chromatic aberration. */}
      <feDisplacementMap
        in="SourceGraphic"
        in2="DISPLACEMENT_MAP"
        scale={displacement}
        xChannelSelector="R"
        yChannelSelector="B"
        result="DISPLACED_R"
      />
      {channelMatrix("DISPLACED_R", "RED_CHANNEL", 0)}

      <feDisplacementMap
        in="SourceGraphic"
        in2="DISPLACEMENT_MAP"
        scale={displacement - aberration * 0.5}
        xChannelSelector="R"
        yChannelSelector="B"
        result="DISPLACED_G"
      />
      {channelMatrix("DISPLACED_G", "GREEN_CHANNEL", 1)}

      <feDisplacementMap
        in="SourceGraphic"
        in2="DISPLACEMENT_MAP"
        scale={displacement - aberration}
        xChannelSelector="R"
        yChannelSelector="B"
        result="DISPLACED_B"
      />
      {channelMatrix("DISPLACED_B", "BLUE_CHANNEL", 2)}

      <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
      <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />
      <feGaussianBlur in="RGB_COMBINED" stdDeviation={blur} result="ABERRATED_BLURRED" />
      <feComposite in="ABERRATED_BLURRED" in2="EDGE_MASK" operator="in" result="EDGE_ABERRATION" />

      {/* Invert the mask so the untouched centre can be laid back on top. */}
      <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
        <feFuncA type="table" tableValues="1 0" />
      </feComponentTransfer>
      <feComposite in="CENTER_ORIGINAL" in2="INVERTED_MASK" operator="in" result="CENTER_CLEAN" />
      <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
    </filter>
  );
}

/**
 * The complete shared filter set. Mounted once, at the app shell level.
 * Kept in the layout as an inline (zero-size) SVG rather than `display:none`,
 * which would invalidate `filter: url(#…)` references.
 */
export function GlassFilterDefs() {
  return (
    <svg className="sg-filter-defs" aria-hidden="true" focusable="false">
      <defs>
        <RefractionFilter preset={REFRACTION_PRESETS.subtle} suffix="subtle" />
        <RefractionFilter preset={REFRACTION_PRESETS.standard} suffix="standard" />
        <RefractionFilter preset={REFRACTION_PRESETS.prominent} suffix="prominent" />
      </defs>
    </svg>
  );
}
