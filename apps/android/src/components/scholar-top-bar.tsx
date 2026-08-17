import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PlanBadge } from "@/components/plan-badge";
import { useAuth } from "@/hooks/use-auth";
import { useScholarShell } from "@/navigation/scholar-shell-context";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export function ScholarTopBar() {
  const { user, session } = useAuth();
  const { openDrawer, openSearch } = useScholarShell();
  const router = useRouter();
  const initial = (user?.name ?? "S").charAt(0).toUpperCase();
  return (
    <View style={styles.bar}>
      <Pressable accessibilityLabel="Open navigation menu" onPress={openDrawer} style={styles.iconButton}><Ionicons name="menu" size={21} color={colors.text} /></Pressable>
      <View style={styles.classBadge}><Text style={styles.classText}>CLASS {user?.currentScholarClass ?? "—"}</Text></View>
      <Pressable accessibilityLabel="Search" onPress={openSearch} style={styles.search}><Ionicons name="search" size={17} color={colors.textMuted} /></Pressable>
      <Pressable accessibilityLabel="Open LAM" onPress={() => router.push("/(tabs)/lam")} style={styles.iconButton}><Ionicons name="sparkles-outline" size={18} color={colors.textSecondary} /></Pressable>
      <PlanBadge plan={session?.plan} compact />
      <View style={styles.coinPill}><Ionicons name="disc-outline" size={13} color={colors.textSecondary} /><Text style={styles.coinText}>{user?.coins ?? "—"}</Text></View>
      <Pressable accessibilityLabel="Open profile" onPress={() => router.push("/(tabs)/profile")} style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 52 },
  iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.glass, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  classBadge: { height: 30, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.glass, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  classText: { color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 0.7 },
  search: { flex: 1, minWidth: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.glass, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  coinPill: { height: 30, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: colors.glass, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  coinText: { color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: typography.tiny },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.text },
  avatarText: { color: colors.background, fontFamily: fonts.semibold, fontSize: typography.caption },
});
