/**
 * PlanBadge — shows the server-authoritative plan (FREE / PLUS / DEVELOPER /
 * UNLOCKED) from the session response. Nothing is faked: if the session has
 * no plan, nothing is rendered.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, typography } from "@/theme";
import type { Plan } from "@/types/api";

const PLAN_STYLES: Record<Plan, { label: string; background: string; border: string; text: string }> = {
  FREE: {
    label: "Free",
    background: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.14)",
    text: colors.textSecondary,
  },
  PLUS: {
    label: "Scholar Plus",
    background: "rgba(99,102,241,0.18)",
    border: "rgba(99,102,241,0.5)",
    text: "#C7CBFF",
  },
  DEVELOPER: {
    label: "Developer",
    background: "rgba(20,184,166,0.14)",
    border: "rgba(20,184,166,0.45)",
    text: "#99F6E4",
  },
  UNLOCKED: {
    label: "Unlocked",
    background: "rgba(139,92,246,0.16)",
    border: "rgba(139,92,246,0.5)",
    text: "#DDD6FE",
  },
};

export function PlanBadge({ plan, compact = false }: { plan?: Plan; compact?: boolean }) {
  if (!plan) return null;
  const style = PLAN_STYLES[plan];
  return (
    <View style={[styles.badge, compact && styles.badgeCompact, { backgroundColor: style.background, borderColor: style.border }]}> 
      <Text style={[styles.text, compact && styles.textCompact, { color: style.text }]}>{style.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: typography.caption,
    letterSpacing: 0.4,
  },
  badgeCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  textCompact: {
    fontSize: 8,
    letterSpacing: 0.2,
  },
});
