/**
 * StudyScreen — subject list shell. The subjects mirror Scholar's real
 * curriculum; chapter content, progress and study tools arrive in Phase 2.
 */
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/glass-card";
import { ScholarBackground } from "@/components/scholar-background";
import { ScholarSectionHeader } from "@/components/scholar-section-header";
import { ScholarTopBar } from "@/components/scholar-top-bar";
import { colors, fonts, radius, spacing, typography } from "@/theme";
import { SafeAreaView } from "react-native-safe-area-context";

const SUBJECTS = [
  { key: "maths", label: "Mathematics", icon: "calculator-outline", accent: colors.indigo },
  { key: "science", label: "Science", icon: "flask-outline", accent: colors.teal },
  { key: "sst", label: "Social Science", icon: "globe-outline", accent: colors.violet },
  { key: "english", label: "English", icon: "book-outline", accent: "#F59E0B" },
  { key: "hindi", label: "Hindi", icon: "chatbubble-ellipses-outline", accent: "#EC4899" },
] as const;

export function StudyScreen() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScholarBackground />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <ScholarTopBar />
        <ScholarSectionHeader eyebrow="Scholar curriculum" title="Study" />
        <Text style={styles.subtitle}>
          Chapters, progress tracking and study tools are being migrated to Android.
        </Text>

        <View style={styles.chips}>
          {SUBJECTS.map((subject) => {
            const active = selected === subject.key;
            return (
              <Pressable
                key={subject.key}
                onPress={() => setSelected(active ? null : subject.key)}
                style={({ pressed }) => [
                  styles.chip,
                  active && { borderColor: subject.accent, backgroundColor: `${subject.accent}1F` },
                  pressed && styles.chipPressed,
                ]}
              >
                <Ionicons name={subject.icon} size={16} color={active ? subject.accent : colors.textSecondary} />
                <Text style={[styles.chipLabel, active && { color: subject.accent }]}>
                  {subject.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <GlassCard style={styles.placeholder}>
          <View style={styles.placeholderIcon}>
            <Ionicons name="construct-outline" size={26} color={colors.indigo} />
          </View>
          <Text style={styles.placeholderTitle}>Chapter library — Phase 2</Text>
          <Text style={styles.placeholderText}>
            {selected
              ? `${SUBJECTS.find((s) => s.key === selected)?.label} chapters will appear here.`
              : "Pick a subject to explore. Chapter content, progress and study tools arrive in Phase 2."}
          </Text>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 112,
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.title,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: typography.label,
    lineHeight: 20,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
  },
  placeholder: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  placeholderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceStrong,
  },
  placeholderTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
});
