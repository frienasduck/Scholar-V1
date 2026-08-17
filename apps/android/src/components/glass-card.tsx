/**
 * GlassCard — translucent surface with subtle blur and a hairline border
 * (Apple-inspired liquid glass). Falls back to a translucent fill on Android
 * where blur is unavailable.
 */
import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radius, spacing } from "@/theme";

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Stronger surface (e.g. dialogs / inputs). */
  elevated?: boolean;
}

export function GlassCard({ children, style, elevated = false }: GlassCardProps) {
  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={elevated ? 30 : 22} tint="dark" style={[styles.base, elevated && styles.elevated, style]}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[styles.base, elevated && styles.elevated, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    overflow: "hidden",
    padding: spacing.lg,
  },
  elevated: {
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderStrong,
    shadowColor: "#000000",
    shadowOpacity: 0.32,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
});
