import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/glass-card";
import { colors, fonts, spacing, typography } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;
export function ScholarMetric({ icon, label, value, note }: { icon: IconName; label: string; value: string; note: string }) {
  return <GlassCard style={styles.card}><View style={styles.top}><View style={styles.icon}><Ionicons name={icon} size={15} color={colors.textSecondary} /></View><Text style={styles.label}>{label}</Text></View><Text style={styles.value}>{value}</Text><Text style={styles.note}>{note}</Text></GlassCard>;
}

const styles = StyleSheet.create({
  card: { width: "48%", flexGrow: 1, gap: spacing.xs, padding: spacing.md },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  icon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.glassHighlight },
  label: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase" },
  value: { color: colors.text, fontFamily: fonts.display, fontSize: 25 },
  note: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: typography.tiny },
});
