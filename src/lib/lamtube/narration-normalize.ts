const SUBSCRIPT_MAP: Record<string, string> = {
  "₀": " 0",
  "₁": " 1",
  "₂": " 2",
  "₃": " 3",
  "₄": " 4",
  "₅": " 5",
  "₆": " 6",
  "₇": " 7",
  "₈": " 8",
  "₉": " 9",
  "ₓ": " x",
  "ᵧ": " y",
};

/**
 * Convert mathematical, physics, and chemistry unicode symbols into spoken phrases
 * while staying within the 200-character TTS phrase limit.
 */
export function normalizeForSpeech(raw: string): string {
  const input = raw.trim();
  if (!input) return input;
  // Leave plain prose unchanged so simple sentences keep exact parity.
  if (!/[₀₁₂₃₄₅₆₇₈₉ₓᵧ²³⁺⁻Δθαβγλπω√×÷≈≠≤≥→⇌°·^]/.test(input) && !/\b(?:m\/s|km\/h|e-)\b/i.test(input)) {
    return input;
  }

  let s = input
    .replace(/m\/s²|m\/s\^2/g, "metres per second squared")
    .replace(/m\/s/g, "metres per second")
    .replace(/km\/h/g, "kilometres per hour")
    .replace(/\bNa⁺|\bNa\+/g, "sodium ion")
    .replace(/\bCl⁻|\bCl-/g, "chloride ion")
    .replace(/\bv₀|\bv_0/g, "v naught")
    .replace(/\bu₀|\bu_0/g, "u naught")
    .replace(/\bx₀|\bx_0/g, "x naught")
    .replace(/\by₀|\by_0/g, "y naught")
    .replace(/\be⁻|\be\^-/g, "electron")
    .replace(/([A-Za-z0-9)])\s*²|\^2\b/g, "$1 squared")
    .replace(/([A-Za-z0-9)])\s*³|\^3\b/g, "$1 cubed")
    .replace(/⁺/g, " plus ion")
    .replace(/⁻/g, " minus ion")
    .replace(/([₀₁₂₃₄₅₆₇₈₉ₓᵧ])/g, (m) => SUBSCRIPT_MAP[m] ?? m)
    .replace(/Δ/g, " delta ")
    .replace(/θ/g, " theta ")
    .replace(/π/g, " pi ")
    .replace(/α/g, " alpha ")
    .replace(/β/g, " beta ")
    .replace(/γ/g, " gamma ")
    .replace(/λ/g, " lambda ")
    .replace(/ω/g, " omega ")
    .replace(/√/g, " square root of ")
    .replace(/°/g, " degrees")
    .replace(/×/g, " times ")
    .replace(/÷/g, " divided by ")
    .replace(/≈/g, " is approximately ")
    .replace(/≠/g, " is not equal to ")
    .replace(/≤/g, " is less than or equal to ")
    .replace(/≥/g, " is greater than or equal to ")
    .replace(/⇌/g, " is in equilibrium with ")
    .replace(/→|=>/g, " produces ")
    .replace(/·/g, " dot ")
    .replace(/\s+/g, " ")
    .trim();

  if (s.length <= 200) return s;
  // Compact slightly if expansion pushed over the strict 200-char speech limit.
  s = input
    .replace(/m\/s²|m\/s\^2/g, "meters per second squared")
    .replace(/²/g, " squared")
    .replace(/³/g, " cubed")
    .replace(/Δ/g, "delta ")
    .replace(/θ/g, "theta")
    .replace(/π/g, "pi")
    .replace(/→/g, "gives")
    .replace(/([₀₁₂₃₄₅₆₇₈₉])/g, (m) => SUBSCRIPT_MAP[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
  return s.length <= 200 ? s : input;
}
