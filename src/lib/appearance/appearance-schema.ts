export const APPEARANCE_SCHEMA_VERSION = 1;

export const APPEARANCE_PAGES = [
  "dashboard", "files", "ebook", "notes", "ai-tools", "ai-tutor", "canvas",
  "slides", "auto-lecture", "quiz", "mock-exam", "community", "resources",
  "downloads", "settings",
] as const;

export type AppearancePage = (typeof APPEARANCE_PAGES)[number];
export type ThemeMode = "system" | "light" | "dark" | "oled" | "schedule";
export type AppearanceDensity = "compact" | "balanced" | "comfortable" | "spacious";
export type WallpaperKind = "none" | "solid" | "gradient" | "scholar" | "custom-image" | "video";
export type VisualPerformance = "automatic" | "quality" | "balanced" | "battery" | "performance";

export interface AppearanceColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  selection: string;
  link: string;
  focus: string;
  deriveSupporting: boolean;
}

export interface WallpaperSettings {
  kind: WallpaperKind;
  value: string;
  mediaId?: string;
  mediaName?: string;
  fit: "cover" | "contain" | "fill" | "tile" | "center";
  positionX: number;
  positionY: number;
  zoom: number;
  blur: number;
  brightness: number;
  saturation: number;
  contrast: number;
  opacity: number;
  overlay: number;
  overlayColor: string;
  attachment: "fixed" | "scroll" | "parallax";
  transition: "instant" | "crossfade" | "blur" | "dissolve";
  videoEnabled: boolean;
  videoQuality: "auto" | "low" | "medium" | "high" | "original";
  videoSpeed: number;
  pauseWhenHidden: boolean;
  pauseOnBatterySaver: boolean;
  stillOnMobile: boolean;
  wifiOnly: boolean;
  loop: boolean;
  muted: boolean;
}

export interface TypographySettings {
  interfaceFont: string;
  headingFont: string;
  bodyFont: string;
  readingFont: string;
  mathematicsFont: string;
  codeFont: string;
  canvasFont: string;
  textScale: number;
  interfaceScale: "compact" | "default" | "comfortable" | "large";
  headingScale: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  fontWeight: number;
}

export interface SurfaceSettings {
  glassStyle: "off" | "subtle" | "balanced" | "strong" | "ultra" | "custom";
  opacity: number;
  blur: number;
  saturation: number;
  brightness: number;
  highlight: number;
  edge: number;
  refraction: number;
  noise: number;
  glow: number;
  panelStyle: "solid" | "translucent" | "glass" | "border" | "minimal";
  elevation: "flat" | "subtle" | "medium" | "floating";
  corners: "square" | "slight" | "rounded" | "extra" | "capsule";
  border: "none" | "subtle" | "medium" | "strong";
  shadow: "none" | "subtle" | "medium" | "strong";
  buttonStyle: "solid" | "soft" | "outline" | "glass" | "minimal";
  inputStyle: "filled" | "outline" | "glass" | "minimal";
  buttonRadius: number;
  inputRadius: number;
  focusGlow: number;
}

export interface NavigationAppearance {
  sidebarStyle: "default" | "compact" | "icons" | "floating" | "autohide";
  sidebarWidth: number;
  sidebarOpacity: number;
  showSectionLabels: boolean;
  showNavigationIcons: boolean;
  showProgressCard: boolean;
  expandOnHover: boolean;
  topStyle: "default" | "minimal" | "floating" | "hidden";
  showSearch: boolean;
  showPageTitle: boolean;
  showProfile: boolean;
  showNotifications: boolean;
  transparentTop: boolean;
  compactTop: boolean;
  iconStyle: "outline" | "rounded" | "filled" | "automatic";
  iconSize: "small" | "default" | "large";
  iconLabels: "always" | "hover" | "never";
}

export interface MotionSettings {
  level: "off" | "reduced" | "balanced" | "expressive" | "custom";
  pageTransitions: boolean;
  panelTransitions: boolean;
  hoverMotion: boolean;
  contentReveal: boolean;
  parallax: boolean;
  glassShimmer: boolean;
  backgroundAnimation: boolean;
  loadingAnimation: boolean;
  speed: "faster" | "default" | "slower";
  pointer: "off" | "highlight" | "glow";
  buttonHoverGlow: boolean;
}

export interface ReadingAppearance {
  theme: "match" | "paper" | "warm" | "sepia" | "dark" | "oled";
  font: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  width: number;
  alignment: "left" | "justify";
  focusMode: boolean;
  equationSize: number;
  equationStyle: "plain" | "soft" | "outlined" | "glass";
  equationScrollIndicator: boolean;
  codeTheme: "scholar" | "midnight" | "paper" | "high-contrast";
  codeFontSize: number;
  codeLineHeight: number;
  codeLineNumbers: boolean;
  codeWrap: boolean;
  codeCurrentLine: boolean;
}

export interface AccessibilityAppearance {
  highContrast: boolean;
  reduceTransparency: boolean;
  reduceMotion: boolean;
  increaseTextContrast: boolean;
  underlineLinks: boolean;
  thickFocus: boolean;
  largeTargets: boolean;
  colorVision: "default" | "protanopia" | "deuteranopia" | "tritanopia" | "grayscale";
  avoidColorOnly: boolean;
}

export interface AppearanceCoreSettings {
  schemaVersion: number;
  preset: string;
  themeMode: ThemeMode;
  scheduleLight: string;
  scheduleDark: string;
  sunriseSunset: boolean;
  colors: AppearanceColors;
  wallpaper: WallpaperSettings;
  typography: TypographySettings;
  density: AppearanceDensity;
  contentWidth: "narrow" | "balanced" | "wide" | "full";
  surfaces: SurfaceSettings;
  navigation: NavigationAppearance;
  motion: MotionSettings;
  reading: ReadingAppearance;
  accessibility: AccessibilityAppearance;
  performance: VisualPerformance;
  responsiveMode: "same" | "separate";
  mobile: {
    stillWallpaper: boolean;
    reduceGlass: boolean;
    simplifyMotion: boolean;
    compactNavigation: boolean;
    largeTargets: boolean;
  };
  focusAppearance: boolean;
  examAppearance: boolean;
  pageOverrides: Partial<Record<AppearancePage, string>>;
  rotateWallpapers: "off" | "launch" | "daily" | "weekly" | "page";
  scheduledProfileId: string;
  scheduledProfileTime: string;
}

export interface ScholarAppearanceProfile {
  id: string;
  name: string;
  config: AppearanceCoreSettings;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  isDefault?: boolean;
}

export interface ScholarAppearanceSettings extends AppearanceCoreSettings {
  customProfiles: ScholarAppearanceProfile[];
  previousCustom?: AppearanceCoreSettings;
}

export function appearanceCore(value: ScholarAppearanceSettings): AppearanceCoreSettings {
  const { customProfiles: _profiles, previousCustom: _previous, ...core } = value;
  return structuredClone(core);
}
