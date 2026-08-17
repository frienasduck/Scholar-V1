/**
 * SplashScreen — branded launch screen shown while fonts load and the
 * session is restored. The root layout navigates away once auth resolves.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LogoMark } from "@/components/logo-mark";
import { ScholarBackground } from "@/components/scholar-background";
import { colors, fonts, spacing, typography } from "@/theme";

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <ScholarBackground />
      <View style={styles.mark}>
        <LogoMark size={112} animate />
      </View>
      <Text style={styles.wordmark}>Scholar</Text>
      <Text style={styles.tagline}>Learn · Ask · Master</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  mark: {
    marginBottom: spacing.lg,
  },
  wordmark: {
    color: colors.text,
    fontFamily: fonts.display,
    fontStyle: "italic",
    fontSize: typography.hero,
    letterSpacing: 0.5,
  },
  tagline: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: typography.label,
    letterSpacing: 2,
  },
});
