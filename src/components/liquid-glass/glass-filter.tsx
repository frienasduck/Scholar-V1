/**
 * Three shared, bounded live-backdrop filters. Original signed edge field:
 * neutral centre, opposite bends on opposite edges. Text is a sibling ABOVE
 * the optic, never filtered. Research/provenance: ./ATTRIBUTION.md.
 *
 * Five primitives instead of the previous multi-channel 18-pass chain. The
 * subtle colour rim is painted by CSS, not three full backdrop displacements.
 */
export const REFRACTION_PRESETS = {
  subtle: { id: "subtle", displacement: 0.04, aberration: 0 },
  standard: { id: "standard", displacement: 0.06, aberration: 0 },
  prominent: { id: "prominent", displacement: 0.08, aberration: 0 },
} as const;
export type RefractionPreset = (typeof REFRACTION_PRESETS)[keyof typeof REFRACTION_PRESETS];

/** Small inline SVGs cached once; no canvas, texture updates or frame work. */
function axisMap(vertical: boolean) {
  const colors = vertical ? ["#000000", "#000080", "#0000ff"] : ["#000000", "#800000", "#ff0000"];
  const gradient = '<linearGradient id="s" x1="0" y1="0" x2="' + (vertical ? 0 : 1) + '" y2="' + (vertical ? 1 : 0) + '"><stop stop-color="' + colors[0] + '"/><stop offset=".035" stop-color="' + colors[1] + '"/><stop offset=".965" stop-color="' + colors[1] + '"/><stop offset="1" stop-color="' + colors[2] + '"/></linearGradient>';
  return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs>' + gradient + '</defs><rect width="256" height="256" fill="url(#s)"/></svg>');
}
const MAP_X = axisMap(false), MAP_Y = axisMap(true);
export function displacementMapX() { return MAP_X; }
export function displacementMapY() { return MAP_Y; }

function RefractionFilter({ preset }: { preset: RefractionPreset }) {
  // Explicit object units are essential: feImage percentages otherwise resolve
  // against the zero-size SVG viewport and silently produce an empty field.
  return <filter id={"sg-refraction-" + preset.id} x="0" y="0" width="100%" height="100%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
    <feImage x="0" y="0" width="1" height="1" href={MAP_X} preserveAspectRatio="none" result="X" />
    <feImage x="0" y="0" width="1" height="1" href={MAP_Y} preserveAspectRatio="none" result="Y" />
    <feComposite in="X" in2="Y" operator="arithmetic" k2="1" k3="1" result="FIELD" />
    <feDisplacementMap in="SourceGraphic" in2="FIELD" scale={preset.displacement} xChannelSelector="R" yChannelSelector="B" result="BENT" />
    <feComponentTransfer in="BENT">
      <feFuncR type="linear" slope="0.96" intercept="0.018" />
      <feFuncG type="linear" slope="0.96" intercept="0.018" />
      <feFuncB type="linear" slope="0.96" intercept="0.018" />
    </feComponentTransfer>
  </filter>;
}

export function GlassFilterDefs() {
  return <svg className="sg-filter-defs" aria-hidden="true" focusable="false"><defs>
    {Object.values(REFRACTION_PRESETS).map(preset => <RefractionFilter key={preset.id} preset={preset} />)}
  </defs></svg>;
}
