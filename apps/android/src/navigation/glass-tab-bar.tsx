import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { ScholarLamMark } from "@/components/scholar-lam-mark";
import { colors, fonts, typography } from "@/theme";
import { useScholarShell } from "@/navigation/scholar-shell-context";
import * as Haptics from "expo-haptics";

type IoniconName = keyof typeof Ionicons.glyphMap;
const TABS: Array<{ name: string; label: string; icon: IoniconName; iconActive: IoniconName; lam?: boolean }> = [
  { name: "home", label: "Home", icon: "home-outline", iconActive: "home" },
  { name: "study", label: "Study", icon: "book-outline", iconActive: "book" },
  { name: "lam", label: "LAM", icon: "ellipse-outline", iconActive: "ellipse", lam: true },
  { name: "library", label: "Library", icon: "library-outline", iconActive: "library" },
  { name: "profile", label: "More", icon: "menu-outline", iconActive: "menu" },
];

export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useScholarShell();
  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
      <BlurView intensity={55} tint="dark" experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined} style={styles.bar}>
        {state.routes.map((route, index) => {
          const definition = TABS.find((tab) => tab.name === route.name);
          if (!definition) return null;
          const focused = state.index === index;
          const onPress = () => {
            void Haptics.selectionAsync();
            if (route.name === "profile") { openDrawer(); return; }
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable key={route.key} style={styles.item} onPress={onPress}>
              {definition.lam ? <ScholarLamMark size={22} /> : <Ionicons name={focused ? definition.iconActive : definition.icon} size={21} color={focused ? colors.text : colors.textMuted} />}
              <Text style={[styles.label, focused && styles.labelActive]}>{definition.label}</Text>
              {focused ? <View style={styles.activeDot} /> : null}
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", left: 0, right: 0, bottom: 0 },
  bar: { flexDirection: "row", alignItems: "center", height: 66, backgroundColor: "rgba(5,5,6,0.92)", borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, height: 66, alignItems: "center", justifyContent: "center", gap: 3, paddingTop: 7 },
  label: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: typography.tiny, letterSpacing: 0.2 },
  labelActive: { color: colors.text },
  activeDot: { width: 3, height: 3, borderRadius: 2, marginTop: 1, backgroundColor: colors.text },
});
