import type { ScholarAppearanceSettings, ThemeMode } from "@/lib/appearance/appearance-schema";

const HEX = /^#[0-9a-f]{6}$/i;

export function safeHex(value: string, fallback: string): string {
  return HEX.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

function rgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 };
}

function luminance(hex: string) {
  const channels = Object.values(rgb(hex)).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first: string, second: string): number {
  const bright = Math.max(luminance(safeHex(first, "#ffffff")), luminance(safeHex(second, "#000000")));
  const dark = Math.min(luminance(safeHex(first, "#ffffff")), luminance(safeHex(second, "#000000")));
  return (bright + 0.05) / (dark + 0.05);
}

export function improveAccentContrast(accent: string, dark: boolean): string {
  const candidate = safeHex(accent, "#818cf8");
  const target = dark ? "#0a0a0b" : "#ffffff";
  if (contrastRatio(candidate, target) >= 3) return candidate;
  return dark ? "#a5b4fc" : "#4338ca";
}

export function resolveThemeMode(settings: ScholarAppearanceSettings, now = new Date()): Exclude<ThemeMode, "system" | "schedule"> {
  if (settings.themeMode === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  if (settings.themeMode !== "schedule") return settings.themeMode;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const parse = (time: string) => {
    const [hours, mins] = time.split(":").map(Number);
    return (Number.isFinite(hours) ? hours : 7) * 60 + (Number.isFinite(mins) ? mins : 0);
  };
  const light = settings.sunriseSunset ? 6 * 60 + 30 : parse(settings.scheduleLight);
  const dark = settings.sunriseSunset ? 18 * 60 + 30 : parse(settings.scheduleDark);
  const lightNow = light <= dark ? minutes >= light && minutes < dark : minutes >= light || minutes < dark;
  return lightNow ? "light" : "dark";
}

const FONT_STACKS: Record<string, string> = {
  scholar: "var(--font-geist-sans), Inter, system-ui, sans-serif",
  system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  modern: "var(--font-poppins), system-ui, sans-serif",
  humanist: "Verdana, 'Trebuchet MS', system-ui, sans-serif",
  rounded: "var(--font-poppins), 'Arial Rounded MT Bold', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  book: "var(--font-source-serif-4), Georgia, serif",
  mono: "var(--font-geist-mono), 'JetBrains Mono', monospace",
  accessible: "Arial, Verdana, sans-serif",
  katex: "KaTeX_Main, 'Times New Roman', serif",
  handwritten: "'Segoe Print', 'Bradley Hand', cursive",
};

export function fontStack(id: string): string {
  return FONT_STACKS[id] ?? FONT_STACKS.scholar;
}

function shadowValue(level: ScholarAppearanceSettings["surfaces"]["shadow"]): string {
  if (level === "none") return "none";
  if (level === "medium") return "0 16px 42px rgba(0,0,0,.28)";
  if (level === "strong") return "0 24px 70px rgba(0,0,0,.42)";
  return "0 8px 28px rgba(0,0,0,.18)";
}

function radiusValue(level: ScholarAppearanceSettings["surfaces"]["corners"]): string {
  return { square: "0px", slight: "8px", rounded: "14px", extra: "24px", capsule: "999px" }[level];
}

export function applyAppearanceTokens(settings: ScholarAppearanceSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const separate = settings.responsiveMode === "separate" && mobile;
  const osReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const theme = resolveThemeMode(settings);
  const dark = theme !== "light";
  const reduceMotion = settings.accessibility.reduceMotion || settings.motion.level === "off" || osReducedMotion || (separate && settings.mobile.simplifyMotion);
  const reduceTransparency = settings.accessibility.reduceTransparency || settings.performance === "performance" || settings.performance === "battery";
  const blur = reduceTransparency || (separate && settings.mobile.reduceGlass) ? 0 : settings.surfaces.blur;
  const accent = improveAccentContrast(settings.colors.primary, dark);

  root.classList.toggle("dark", dark);
  root.dataset.appearanceTheme = theme;
  root.dataset.appearancePreset = settings.preset;
  root.dataset.appearanceDensity = settings.density;
  root.dataset.appearancePerformance = settings.performance;
  root.dataset.appearanceContentWidth = settings.contentWidth;
  root.dataset.appearancePanel = settings.surfaces.panelStyle;
  root.dataset.appearanceGlass = reduceTransparency ? "off" : settings.surfaces.glassStyle;
  root.dataset.appearanceCorners = settings.surfaces.corners;
  root.dataset.appearanceButton = settings.surfaces.buttonStyle;
  root.dataset.appearanceInput = settings.surfaces.inputStyle;
  root.dataset.appearanceSidebar = separate && settings.mobile.compactNavigation ? "compact" : settings.navigation.sidebarStyle;
  root.dataset.appearanceTopbar = settings.navigation.topStyle;
  root.dataset.appearanceIconSize = settings.navigation.iconSize;
  root.dataset.appearanceIconLabels = settings.navigation.iconLabels;
  root.dataset.appearanceSidebarExpand = String(settings.navigation.expandOnHover);
  root.dataset.appearanceShowNavIcons = String(settings.navigation.showNavigationIcons);
  root.dataset.appearanceShowSectionLabels = String(settings.navigation.showSectionLabels);
  root.dataset.appearanceShowProgress = String(settings.navigation.showProgressCard);
  root.dataset.appearanceTopSearch = String(settings.navigation.showSearch);
  root.dataset.appearanceTopTitle = String(settings.navigation.showPageTitle);
  root.dataset.appearanceTopProfile = String(settings.navigation.showProfile);
  root.dataset.appearanceTopNotifications = String(settings.navigation.showNotifications);
  root.dataset.appearanceTopTransparent = String(settings.navigation.transparentTop);
  root.dataset.appearanceTopCompact = String(settings.navigation.compactTop);
  root.dataset.appearanceMotion = reduceMotion ? "off" : settings.motion.level;
  root.dataset.appearancePageTransitions = String(settings.motion.pageTransitions && !reduceMotion);
  root.dataset.appearancePanelTransitions = String(settings.motion.panelTransitions && !reduceMotion);
  root.dataset.appearanceHoverMotion = String(settings.motion.hoverMotion && !reduceMotion);
  root.dataset.appearanceContentReveal = String(settings.motion.contentReveal && !reduceMotion);
  root.dataset.appearanceGlassShimmer = String(settings.motion.glassShimmer && !reduceMotion);
  root.dataset.appearanceBackgroundAnimation = String(settings.motion.backgroundAnimation && !reduceMotion);
  root.dataset.appearanceLoadingAnimation = String(settings.motion.loadingAnimation && !reduceMotion);
  root.dataset.appearancePointer = reduceMotion ? "off" : settings.motion.pointer;
  root.dataset.appearanceButtonHoverGlow = String(settings.motion.buttonHoverGlow && !reduceMotion);
  root.dataset.appearanceReading = settings.reading.theme;
  root.dataset.appearanceReadingAlignment = settings.reading.alignment;
  root.dataset.appearanceEquation = settings.reading.equationStyle;
  root.dataset.appearanceEquationScroll = String(settings.reading.equationScrollIndicator);
  root.dataset.appearanceCodeTheme = settings.reading.codeTheme;
  root.dataset.appearanceCodeWrap = String(settings.reading.codeWrap);
  root.dataset.appearanceCodeLines = String(settings.reading.codeLineNumbers);
  root.dataset.appearanceCodeCurrent = String(settings.reading.codeCurrentLine);
  root.dataset.appearanceUnderlineLinks = String(settings.accessibility.underlineLinks);
  root.dataset.appearanceThickFocus = String(settings.accessibility.thickFocus);
  root.dataset.appearanceAvoidColorOnly = String(settings.accessibility.avoidColorOnly);
  root.dataset.appearanceColorVision = settings.accessibility.colorVision;
  root.dataset.appearanceFocus = String(settings.focusAppearance);
  root.dataset.appearanceExam = String(settings.examAppearance);
  root.dataset.reduceMotion = String(reduceMotion);
  root.dataset.highContrast = String(settings.accessibility.highContrast);
  root.dataset.readableFont = String(settings.typography.bodyFont === "accessible");
  root.dataset.density = settings.density === "balanced" ? "comfortable" : settings.density;
  root.dataset.fontScale = String(Math.round(settings.typography.textScale / 10) * 10);
  root.style.setProperty("--scholar-accent", accent);
  root.style.setProperty("--scholar-accent-secondary", safeHex(settings.colors.secondary, "#2dd4bf"));
  root.style.setProperty("--scholar-success", safeHex(settings.colors.success, "#34d399"));
  root.style.setProperty("--scholar-warning", safeHex(settings.colors.warning, "#fbbf24"));
  root.style.setProperty("--scholar-error", safeHex(settings.colors.error, "#fb7185"));
  root.style.setProperty("--scholar-selection", safeHex(settings.colors.selection, "#6366f1"));
  root.style.setProperty("--scholar-link", safeHex(settings.colors.link, "#818cf8"));
  root.style.setProperty("--scholar-focus", safeHex(settings.colors.focus, "#67e8f9"));
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--ring", safeHex(settings.colors.focus, "#67e8f9"));
  root.style.setProperty("--scholar-surface-opacity", `${reduceTransparency ? 0.98 : settings.surfaces.opacity / 100}`);
  root.style.setProperty("--scholar-glass-blur", `${blur}px`);
  root.style.setProperty("--scholar-glass-saturation", `${settings.surfaces.saturation}%`);
  root.style.setProperty("--scholar-surface-brightness", `${settings.surfaces.brightness}%`);
  root.style.setProperty("--scholar-surface-highlight", `${settings.surfaces.highlight / 100}`);
  root.style.setProperty("--scholar-surface-edge", `${settings.surfaces.edge / 100}`);
  root.style.setProperty("--scholar-surface-refraction", `${settings.surfaces.refraction / 100}`);
  root.style.setProperty("--scholar-surface-noise", `${settings.surfaces.noise / 100}`);
  root.style.setProperty("--scholar-surface-glow", `${settings.surfaces.glow / 100}`);
  root.style.setProperty("--scholar-border-opacity", `${{ none: 0, subtle: .1, medium: .22, strong: .4 }[settings.surfaces.border]}`);
  root.style.setProperty("--scholar-radius", radiusValue(settings.surfaces.corners));
  root.style.setProperty("--radius", radiusValue(settings.surfaces.corners));
  root.style.setProperty("--scholar-card-shadow", shadowValue(settings.surfaces.shadow));
  root.style.setProperty("--scholar-button-radius", `${settings.surfaces.buttonRadius}px`);
  root.style.setProperty("--scholar-input-radius", `${settings.surfaces.inputRadius}px`);
  root.style.setProperty("--scholar-focus-glow", `${settings.surfaces.focusGlow / 100}`);
  root.style.setProperty("--scholar-font-interface", fontStack(settings.typography.interfaceFont));
  root.style.setProperty("--scholar-font-heading", fontStack(settings.typography.headingFont));
  root.style.setProperty("--scholar-font-body", fontStack(settings.typography.bodyFont));
  root.style.setProperty("--scholar-font-reading", fontStack(settings.reading.font));
  root.style.setProperty("--scholar-font-code", fontStack(settings.typography.codeFont));
  root.style.setProperty("--scholar-heading-scale", `${settings.typography.headingScale / 100}`);
  root.style.setProperty("--scholar-line-height", String(settings.typography.lineHeight));
  root.style.setProperty("--scholar-letter-spacing", `${settings.typography.letterSpacing}em`);
  root.style.setProperty("--scholar-paragraph-spacing", `${settings.typography.paragraphSpacing}rem`);
  root.style.setProperty("--scholar-font-weight", String(settings.typography.fontWeight));
  root.style.setProperty("--scholar-ui-scale", { compact: ".92", default: "1", comfortable: "1.06", large: "1.12" }[settings.typography.interfaceScale]);
  root.style.setProperty("--scholar-reading-width", `${settings.reading.width}ch`);
  root.style.setProperty("--scholar-reading-size", `${settings.reading.fontSize}px`);
  root.style.setProperty("--scholar-reading-line-height", String(settings.reading.lineHeight));
  root.style.setProperty("--scholar-reading-paragraph-spacing", `${settings.reading.paragraphSpacing}rem`);
  root.style.setProperty("--scholar-equation-size", `${settings.reading.equationSize / 100}em`);
  root.style.setProperty("--scholar-code-size", `${settings.reading.codeFontSize}px`);
  root.style.setProperty("--scholar-code-line-height", String(settings.reading.codeLineHeight));
  root.style.setProperty("--scholar-motion-duration", reduceMotion ? "0.01ms" : ({ faster: "140ms", default: "220ms", slower: "360ms" }[settings.motion.speed]));
  root.style.setProperty("--scholar-sidebar-width", `${settings.navigation.sidebarWidth}px`);
  root.style.setProperty("--scholar-sidebar-opacity", `${settings.navigation.sidebarOpacity / 100}`);
  root.style.setProperty("--scholar-touch-target", settings.accessibility.largeTargets || (separate && settings.mobile.largeTargets) ? "48px" : "40px");
}
