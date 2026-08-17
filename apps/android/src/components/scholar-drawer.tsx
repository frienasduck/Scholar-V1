import React, { useEffect, useRef } from "react";
import { Animated, BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { SCHOLAR_NAV_GROUPS, SCHOLAR_NAV_ITEMS, routeForScholarItem } from "@/navigation/scholar-navigation";
import { useScholarShell } from "@/navigation/scholar-shell-context";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export function ScholarDrawer() {
  const { drawerOpen, closeDrawer } = useScholarShell();
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-340)).current;

  useEffect(() => {
    Animated.timing(translateX, { toValue: drawerOpen ? 0 : -340, duration: drawerOpen ? 260 : 190, useNativeDriver: true }).start();
  }, [drawerOpen, translateX]);

  useEffect(() => {
    if (!drawerOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { closeDrawer(); return true; });
    return () => subscription.remove();
  }, [drawerOpen, closeDrawer]);

  const current = segments.at(-1) ?? "home";
  const navigate = (route: string) => {
    closeDrawer();
    void Haptics.selectionAsync();
    requestAnimationFrame(() => router.push(route as never));
  };

  return (
    <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={closeDrawer} statusBarTranslucent>
      <View style={styles.modal}>
        <Pressable accessibilityLabel="Close Scholar navigation" onPress={closeDrawer} style={styles.backdrop} />
        <Animated.View style={[styles.drawer, { paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, spacing.lg), transform: [{ translateX }] }]}>
          <BlurView intensity={78} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
          <View style={styles.header}>
            <View style={styles.mark}><Text style={styles.markText}>n</Text></View>
            <View style={styles.headerCopy}><Text style={styles.title}>{user?.name?.split(" ")[0] ?? "Scholar"}&apos;s Scholar</Text><Text style={styles.subtitle}>CLASS {user?.currentScholarClass ?? "—"} · STUDY OS</Text></View>
            <Pressable onPress={closeDrawer} hitSlop={12} style={styles.close}><Ionicons name="close" size={20} color={colors.textSecondary} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {SCHOLAR_NAV_GROUPS.map((group) => (
              <View key={group} style={styles.group}>
                <Text style={styles.groupLabel}>{group}</Text>
                {SCHOLAR_NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const route = routeForScholarItem(item);
                  const active = (item.id === "dashboard" && current === "home") || current === item.id;
                  return (
                    <Pressable key={item.id} onPress={() => navigate(route)} style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.itemPressed]}>
                      <Ionicons name={item.icon} size={18} color={active ? colors.text : colors.textMuted} />
                      <Text numberOfLines={1} style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
                      {item.badge ? <View style={[styles.badge, item.badge === "PLUS" && styles.plusBadge]}><Text style={styles.badgeText}>{item.badge === "PLUS" ? "Plus" : item.badge}</Text></View> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, flexDirection: "row" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.68)" },
  drawer: { width: "86%", maxWidth: 340, height: "100%", overflow: "hidden", backgroundColor: "rgba(7,9,14,0.92)", borderRightColor: colors.borderStrong, borderRightWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOpacity: 0.8, shadowRadius: 28, elevation: 24 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  mark: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.glassStrong, borderColor: colors.borderStrong, borderWidth: StyleSheet.hairlineWidth },
  markText: { color: colors.text, fontFamily: fonts.displayItalic, fontSize: 27 },
  headerCopy: { flex: 1, marginLeft: spacing.md, gap: 3 },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: typography.label },
  subtitle: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 8, letterSpacing: 1.25 },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },
  content: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg, gap: spacing.xl },
  group: { gap: 3 },
  groupLabel: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9, letterSpacing: 1.8, textTransform: "uppercase", paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  item: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md },
  itemActive: { backgroundColor: "rgba(129,140,248,0.11)", borderColor: "rgba(129,140,248,0.18)", borderWidth: StyleSheet.hairlineWidth },
  itemPressed: { backgroundColor: colors.glassStrong },
  itemLabel: { flex: 1, color: colors.textSecondary, fontFamily: fonts.medium, fontSize: typography.caption },
  itemLabelActive: { color: colors.text },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: "rgba(129,140,248,0.16)" },
  plusBadge: { backgroundColor: "rgba(251,191,36,0.13)" },
  badgeText: { color: colors.textSecondary, fontFamily: fonts.bold, fontSize: 7, letterSpacing: 0.7 },
});
