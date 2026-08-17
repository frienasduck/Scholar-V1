import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, typography } from "@/theme";

export function ScholarSectionHeader({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return <View style={styles.wrap}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.title}>{title}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 3 },
  eyebrow: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: typography.tiny, letterSpacing: 1.8, textTransform: "uppercase" },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
});
