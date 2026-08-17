/**
 * ProfileScreen — the signed-in Scholar account: name, email, plan, class,
 * configured server, and sign out. Sign-out revokes the server session and
 * clears local secure storage.
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { GlassButton } from "@/components/glass-button";
import { GlassCard } from "@/components/glass-card";
import { PlanBadge } from "@/components/plan-badge";
import { ScholarBackground } from "@/components/scholar-background";
import { ScholarSectionHeader } from "@/components/scholar-section-header";
import { ScholarTopBar } from "@/components/scholar-top-bar";
import { useAuth } from "@/hooks/use-auth";
import { colors, fonts, radius, spacing, typography } from "@/theme";
import { SafeAreaView } from "react-native-safe-area-context";

export function ProfileScreen() {
  const { user, session, apiUrl, logout } = useAuth();

  const rows = [
    {
      key: "email",
      icon: "mail-outline" as const,
      label: "Email",
      value: user?.email ?? "—",
    },
    {
      key: "class",
      icon: "school-outline" as const,
      label: "Class",
      value: user?.currentScholarClass ? `Class ${user.currentScholarClass}` : "—",
    },
    {
      key: "coins",
      icon: "cash-outline" as const,
      label: "Coins",
      value: String(user?.coins ?? 0),
    },
    {
      key: "server",
      icon: "server-outline" as const,
      label: "Server",
      value: apiUrl || "Not configured",
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScholarBackground />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <ScholarTopBar />
        <ScholarSectionHeader eyebrow="Scholar account" title="Profile" />

        <GlassCard elevated style={styles.account}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name ?? "S").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.name}>{user?.name ?? "Scholar"}</Text>
            <Text style={styles.role}>{user?.role === "ADMIN" ? "Scholar Admin" : "Student"}</Text>
          </View>
          <PlanBadge plan={session?.plan} />
        </GlassCard>

        <GlassCard style={styles.rows}>
          {rows.map((row, index) => (
            <View
              key={row.key}
              style={[styles.row, index < rows.length - 1 && styles.rowBorder]}
            >
              <Ionicons name={row.icon} size={18} color={colors.textMuted} />
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {row.value}
              </Text>
            </View>
          ))}
        </GlassCard>

        <GlassCard style={styles.notes}>
          <Text style={styles.notesTitle}>Scholar Plus</Text>
          <Text style={styles.notesBody}>
            {session?.plan === "PLUS"
              ? "You have Scholar Plus — premium features will unlock on Android as they are migrated."
              : "Scholar Plus subscriptions from the web app are server-side and will carry over to Android."}
          </Text>
        </GlassCard>

        <GlassButton
          label="Sign out"
          variant="danger"
          onPress={() => {
            void logout();
          }}
        />

        <Text style={styles.version}>
          Scholar Android · v{Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
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
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarText: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.title,
  },
  accountInfo: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
  },
  role: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
  },
  rows: {
    gap: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowBorder: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: typography.label,
  },
  rowValue: {
    flex: 1,
    textAlign: "right",
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.label,
  },
  notes: {
    gap: spacing.sm,
  },
  notesTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
  },
  notesBody: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  version: {
    textAlign: "center",
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
  },
});
