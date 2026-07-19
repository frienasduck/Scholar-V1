import { profileGetItem, profileSetItem } from "@/lib/profile-storage";

export type ScholarTheme = {
  id: string;
  name: string;
  description: string;
  swatches: string[];
};

export const SCHOLAR_THEMES: ScholarTheme[] = [
  { id: "theme-default", name: "Scholar Midnight", description: "The original high-contrast indigo and teal study theme.", swatches: ["#111827", "#818cf8", "#2dd4bf"] },
  { id: "theme-aurora", name: "Aurora", description: "Emerald and violet accents over a deep northern-sky canvas.", swatches: ["#071a18", "#34d399", "#a78bfa"] },
  { id: "theme-sunset", name: "Sunset", description: "Warm amber and rose accents designed for evening revision.", swatches: ["#21110f", "#fbbf24", "#fb7185"] },
  { id: "theme-glass", name: "Glassmorphism Pro", description: "Cool cyan glass surfaces with stronger depth and focus rings.", swatches: ["#07131f", "#67e8f9", "#60a5fa"] },
  { id: "theme-paper", name: "Focus Paper", description: "A calm, warm light theme with ink-blue controls.", swatches: ["#faf7ef", "#315a88", "#0f766e"] },
];

export const THEME_EVENT = "scholar:theme-change";

export function isThemeId(value: string | null): value is string {
  return !!value && SCHOLAR_THEMES.some((theme) => theme.id === value);
}

export function getEquippedTheme(scholarClass: 9 | 11): string {
  const saved = profileGetItem(scholarClass, "equipped-theme");
  return isThemeId(saved) ? saved : "theme-default";
}

export function applyTheme(themeId: string) {
  const safe = isThemeId(themeId) ? themeId : "theme-default";
  document.documentElement.dataset.scholarTheme = safe;
  document.documentElement.classList.toggle("dark", safe !== "theme-paper");
}

export function equipTheme(scholarClass: 9 | 11, themeId: string) {
  const safe = isThemeId(themeId) ? themeId : "theme-default";
  profileSetItem(scholarClass, "equipped-theme", safe);
  applyTheme(safe);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { scholarClass, themeId: safe } }));
}
