/**
 * Scholar — premium dark theme tokens.
 * Dark graphite backgrounds, indigo/violet highlights, glass surfaces.
 * Mirrors the Scholar web identity (indigo #6366F1 + teal #14B8A6).
 */

export const colors = {
  // Backgrounds — dark graphite
  background: "#050506",
  backgroundElevated: "#090A0D",
  surface: "#0D0E12",
  surfaceStrong: "#15161B",

  // Glass surfaces (translucent, used with blur)
  glass: "rgba(255, 255, 255, 0.035)",
  glassStrong: "rgba(255, 255, 255, 0.065)",
  glassHighlight: "rgba(255, 255, 255, 0.11)",
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(255, 255, 255, 0.20)",

  // Text
  text: "#F7F7F8",
  textSecondary: "rgba(255, 255, 255, 0.68)",
  textMuted: "rgba(255, 255, 255, 0.42)",

  // Brand accents
  indigo: "#6366F1",
  violet: "#8B5CF6",
  teal: "#14B8A6",
  white: "#FFFFFF",

  // Status
  danger: "#F87171",
  success: "#34D399",
  gold: "#FBBF24",

  // Glows
  glowIndigo: "rgba(99, 102, 241, 0.35)",
  glowViolet: "rgba(139, 92, 246, 0.35)",
} as const;

/** Primary brand gradient (indigo -> violet). */
export const brandGradient = [colors.indigo, colors.violet] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  hero: 40,
  title: 28,
  headline: 20,
  body: 16,
  label: 14,
  caption: 12,
  tiny: 10,
} as const;

/** Inter font families (loaded in app/_layout.tsx via @expo-google-fonts/inter). */
export const fonts = {
  display: "SourceSerif4_400Regular",
  displayMedium: "SourceSerif4_500Medium",
  displayItalic: "SourceSerif4_400Regular_Italic",
  displayMediumItalic: "SourceSerif4_500Medium_Italic",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;
