/**
 * LibraryScreen — shell for the Scholar library (notes, files, eBooks,
 * flashcards). Sync of real content arrives in Phase 2.
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/glass-card";
import { ScholarBackground } from "@/components/scholar-background";
import { ScholarSectionHeader } from "@/components/scholar-section-header";
import { ScholarTopBar } from "@/components/scholar-top-bar";
import { colors, fonts, radius, spacing, typography } from "@/theme";
import { SafeAreaView } from "react-native-safe-area-context";

const ITEMS = [
  { key: "notes", label: "Notes", icon: "document-text-outline", accent: colors.indigo },
  { key: "files", label: "Files", icon: "folder-open-outline", accent: colors.violet },
  { key: "ebooks", label: "E-Books", icon: "book-outline", accent: colors.teal },
  { key: "flashcards", label: "Flashcards", icon: "layers-outline", accent: "#F59E0B" },
] as const;

export function LibraryScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScholarBackground />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <ScholarTopBar />
        <ScholarSectionHeader eyebrow="Saved learning" title="Library" />
        <Text style={styles.subtitle}>
          Your saved Scholar content — synced from the same account as the web app.
        </Text>

        <View style={styles.grid}>
          {ITEMS.map((item) => (
            <View key={item.key} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: `${item.accent}1A` }]}>
                <Ionicons name={item.icon} size={24} color={item.accent} />
              </View>
              <Text style={styles.tileLabel}>{item.label}</Text>
              <Text style={styles.tileBadge}>Phase 2</Text>
            </View>
          ))}
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>One account, everywhere</Text>
          <Text style={styles.cardBody}>
            Notes, uploaded files, eBooks and flashcards created on Scholar Web will sync to this
            library once migration lands.
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
    gap: spacing.xl,
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  tile: {
    width: "47%",
    flexGrow: 1,
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
  },
  tileBadge: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: typography.tiny,
    letterSpacing: 0.5,
  },
  card: {
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
  },
  cardBody: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
