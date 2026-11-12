/**
 * Three shared, bounded live-backdrop filters. Original signed edge field:
 * neutral centre, opposite bends on opposite edges. Text is a sibling ABOVE
 * the optic, never filtered. Research/provenance: ./ATTRIBUTION.md.
 *
 * Five primitives instead of the previous multi-channel 18-pass chain. The
 * subtle colour rim is painted by CSS, not three full backdrop displacements.
 */
export const REFRACTION_PRESETS = {
  subtle: { id: "subtle", displacement: 0.02, aberration: 0 },
  standard: { id: "standard", displacement: 0.032, aberration: 0 },
  prominent: { id: "prominent", displacement: 0.05, aberration: 0 },
} as const;
export type RefractionPreset = (typeof REFRACTION_PRESETS)[keyof typeof REFRACTION_PRESETS];

/** Small inline SVGs cached once; no canvas, texture updates or frame work. */
function axisMap(vertical: boolean, edge = .035) {
  const colors = vertical ? ["#000000", "#000080", "#0000ff"] : ["#000000", "#800000", "#ff0000"];
  const start = String(edge).replace(/^0\./, "."), end = String(1 - edge).replace(/^0\./, ".");
  const gradient = '<linearGradient id="s" x1="0" y1="0" x2="' + (vertical ? 0 : 1) + '" y2="' + (vertical ? 1 : 0) + '"><stop stop-color="' + colors[0] + '"/><stop offset="' + start + '" stop-color="' + colors[1] + '"/><stop offset="' + end + '" stop-color="' + colors[1] + '"/><stop offset="1" stop-color="' + colors[2] + '"/></linearGradient>';
  return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs>' + gradient + '</defs><rect width="256" height="256" fill="url(#s)"/></svg>');
}
const MAP_X = axisMap(false), MAP_Y = axisMap(true);
// The original 3.5% rim is barely a pixel on a phone-sized lens. This static
// compact field widens its bend while leaving every existing preset intact.
const DOCK_MAP_X = axisMap(false, .18), DOCK_MAP_Y = axisMap(true, .18);
const TOPBAR_MAP_Y = (() => {
  const g = '<linearGradient id="ty" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#000014"/>'
    + '<stop offset=".24" stop-color="#000080"/>'
    + '<stop offset=".68" stop-color="#000080"/>'
    + '<stop offset=".9" stop-color="#0000d4"/>'
    + '<stop offset="1" stop-color="#0000ff"/>'
    + '</linearGradient>';
  return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="64"><defs>' + g + '</defs><rect width="256" height="64" fill="url(#ty)"/></svg>');
})();
const TOPBAR_MAP_X = (() => {
  const g = '<linearGradient id="tx" x1="0" y1="0" x2="1" y2="0">'
    + '<stop offset="0" stop-color="#780000"/>'
    + '<stop offset=".035" stop-color="#800000"/>'
    + '<stop offset=".965" stop-color="#800000"/>'
    + '<stop offset="1" stop-color="#880000"/>'
    + '</linearGradient>';
  return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="64"><defs>' + g + '</defs><rect width="256" height="64" fill="url(#tx)"/></svg>');
})();
export function displacementMapX() { return MAP_X; }
export function displacementMapY() { return MAP_Y; }

function RefractionFilter({ preset, compact = false }: { preset: { id: string; displacement: number }; compact?: boolean }) {
  // Explicit object units are essential: feImage percentages otherwise resolve
  // against the zero-size SVG viewport and silently produce an empty field.
  return <filter id={"sg-refraction-" + preset.id} x="0" y="0" width="100%" height="100%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
    <feImage x="0" y="0" width="1" height="1" href={compact ? DOCK_MAP_X : MAP_X} preserveAspectRatio="none" result="X" />
    <feImage x="0" y="0" width="1" height="1" href={compact ? DOCK_MAP_Y : MAP_Y} preserveAspectRatio="none" result="Y" />
    <feComposite in="X" in2="Y" operator="arithmetic" k2="1" k3="1" result="FIELD" />
    <feGaussianBlur in="FIELD" stdDeviation="0.018" result="SMOOTH_FIELD" />
    <feDisplacementMap in="SourceGraphic" in2="SMOOTH_FIELD" scale={preset.displacement} xChannelSelector="R" yChannelSelector="B" result="BENT" />
    <feComponentTransfer in="BENT">
      <feFuncR type="linear" slope="0.96" intercept="0.018" />
      <feFuncG type="linear" slope="0.96" intercept="0.018" />
      <feFuncB type="linear" slope="0.96" intercept="0.018" />
    </feComponentTransfer>
  </filter>;
}

function TopbarRefractionFilter() {
  return <filter id="sg-refraction-topbar" x="0" y="0" width="100%" height="100%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
    <feImage x="0" y="0" width="1" height="1" href={TOPBAR_MAP_X} preserveAspectRatio="none" result="TX" />
    <feImage x="0" y="0" width="1" height="1" href={TOPBAR_MAP_Y} preserveAspectRatio="none" result="TY" />
    <feComposite in="TX" in2="TY" operator="arithmetic" k2="1" k3="1" result="T_FIELD" />
    <feGaussianBlur in="T_FIELD" stdDeviation="0.008" result="T_SMOOTH" />
    <feDisplacementMap in="SourceGraphic" in2="T_SMOOTH" scale="0.14" xChannelSelector="R" yChannelSelector="B" result="T_BENT" />
    <feComponentTransfer in="T_BENT">
      <feFuncR type="linear" slope="0.98" intercept="0.015" />
      <feFuncG type="linear" slope="0.98" intercept="0.015" />
      <feFuncB type="linear" slope="0.98" intercept="0.015" />
    </feComponentTransfer>
  </filter>;
}

export function TopbarRefractionDefs() {
  return <svg className="sg-filter-defs" aria-hidden="true" focusable="false"><defs>
    <TopbarRefractionFilter />
  </defs></svg>;
}

/** Shared compact definition, also available to an active button/menu. It does
 * not register another optical surface or bypass engine/user/budget gates. */
export function DockRefractionDefs() {
  return <svg className="sg-filter-defs" aria-hidden="true" focusable="false"><defs>
    <RefractionFilter preset={{ id: "dock", displacement: .14 }} compact />
  </defs></svg>;
}

export function GlassFilterDefs() {
  return <svg className="sg-filter-defs" aria-hidden="true" focusable="false"><defs>
    {Object.values(REFRACTION_PRESETS).map(preset => <RefractionFilter key={preset.id} preset={preset} />)}
    <RefractionFilter preset={{ id: "dock", displacement: .14 }} compact />
  </defs></svg>;
}
