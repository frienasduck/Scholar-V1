import type { ScholarAppearanceSettings } from "@/lib/appearance/appearance-schema";

export const DEFAULT_APPEARANCE: ScholarAppearanceSettings = {
  schemaVersion: 1,
  preset: "scholar-default",
  themeMode: "dark",
  scheduleLight: "07:00",
  scheduleDark: "18:30",
  sunriseSunset: false,
  colors: {
    primary: "#818cf8", secondary: "#2dd4bf", success: "#34d399", warning: "#fbbf24",
    error: "#fb7185", selection: "#6366f1", link: "#818cf8", focus: "#67e8f9", deriveSupporting: true,
  },
  wallpaper: {
    kind: "none", value: "none", fit: "cover", positionX: 50, positionY: 50, zoom: 100,
    blur: 0, brightness: 100, saturation: 100, contrast: 100, opacity: 100, overlay: 0,
    overlayColor: "#000000", attachment: "fixed", transition: "crossfade", videoEnabled: true,
    videoQuality: "auto", videoSpeed: 1, pauseWhenHidden: true, pauseOnBatterySaver: true,
    stillOnMobile: false, wifiOnly: false, loop: true, muted: true,
  },
  typography: {
    interfaceFont: "scholar", headingFont: "scholar", bodyFont: "scholar", readingFont: "book",
    mathematicsFont: "katex", codeFont: "mono", canvasFont: "handwritten", textScale: 100,
    interfaceScale: "default", headingScale: 100, lineHeight: 1.55, letterSpacing: 0,
    paragraphSpacing: 0.75, fontWeight: 400,
  },
  density: "comfortable",
  contentWidth: "full",
  surfaces: {
    glassStyle: "balanced", opacity: 82, blur: 18, saturation: 135, brightness: 100,
    highlight: 20, edge: 14, refraction: 0, noise: 0, glow: 10, panelStyle: "glass",
    elevation: "subtle", corners: "rounded", border: "subtle", shadow: "subtle",
    buttonStyle: "soft", inputStyle: "outline", buttonRadius: 12, inputRadius: 12, focusGlow: 35,
  },
  navigation: {
    sidebarStyle: "default", sidebarWidth: 256, sidebarOpacity: 100, showSectionLabels: true,
    showNavigationIcons: true, showProgressCard: false, expandOnHover: false, topStyle: "default",
    showSearch: true, showPageTitle: false, showProfile: true, showNotifications: true,
    transparentTop: true, compactTop: false, iconStyle: "automatic", iconSize: "default", iconLabels: "always",
  },
  motion: {
    level: "balanced", pageTransitions: true, panelTransitions: true, hoverMotion: true,
    contentReveal: true, parallax: false, glassShimmer: false, backgroundAnimation: true,
    loadingAnimation: true, speed: "default", pointer: "off", buttonHoverGlow: false,
  },
  reading: {
    theme: "match", font: "book", fontSize: 17, lineHeight: 1.7, paragraphSpacing: 1,
    width: 72, alignment: "left", focusMode: false, equationSize: 106,
    equationStyle: "soft", equationScrollIndicator: true, codeTheme: "scholar",
    codeFontSize: 14, codeLineHeight: 1.6, codeLineNumbers: false, codeWrap: true, codeCurrentLine: false,
  },
  accessibility: {
    highContrast: false, reduceTransparency: false, reduceMotion: false, increaseTextContrast: false,
    underlineLinks: false, thickFocus: false, largeTargets: false, colorVision: "default", avoidColorOnly: true,
  },
  performance: "automatic",
  responsiveMode: "same",
  mobile: { stillWallpaper: false, reduceGlass: true, simplifyMotion: true, compactNavigation: true, largeTargets: true },
  focusAppearance: false,
  examAppearance: false,
  pageOverrides: {},
  rotateWallpapers: "off",
  scheduledProfileId: "off",
  scheduledProfileTime: "20:00",
  customProfiles: [],
};

function mergeObject<T extends object>(base: T, value: unknown): T {
  return value && typeof value === "object" ? { ...base, ...(value as Partial<T>) } : base;
}

export function migrateAppearance(value: unknown): ScholarAppearanceSettings {
  const source = value && typeof value === "object" ? value as Partial<ScholarAppearanceSettings> : {};
  return {
    ...DEFAULT_APPEARANCE,
    ...source,
    schemaVersion: 1,
    colors: mergeObject(DEFAULT_APPEARANCE.colors, source.colors),
    wallpaper: mergeObject(DEFAULT_APPEARANCE.wallpaper, source.wallpaper),
    typography: mergeObject(DEFAULT_APPEARANCE.typography, source.typography),
    surfaces: mergeObject(DEFAULT_APPEARANCE.surfaces, source.surfaces),
    navigation: mergeObject(DEFAULT_APPEARANCE.navigation, source.navigation),
    motion: mergeObject(DEFAULT_APPEARANCE.motion, source.motion),
    reading: mergeObject(DEFAULT_APPEARANCE.reading, source.reading),
    accessibility: mergeObject(DEFAULT_APPEARANCE.accessibility, source.accessibility),
    mobile: mergeObject(DEFAULT_APPEARANCE.mobile, source.mobile),
    pageOverrides: source.pageOverrides && typeof source.pageOverrides === "object" ? source.pageOverrides : {},
    customProfiles: Array.isArray(source.customProfiles) ? source.customProfiles.slice(0, 24) : [],
  };
}
