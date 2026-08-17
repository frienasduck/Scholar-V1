import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassCard } from "@/components/glass-card";
import { ScholarBackground } from "@/components/scholar-background";
import { SCHOLAR_NAV_ITEMS } from "@/navigation/scholar-navigation";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export function FeaturePlaceholderScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const feature = SCHOLAR_NAV_ITEMS.find((item) => item.id === slug);
  const label = feature?.label ?? "Scholar feature";
  return (
    <SafeAreaView style={styles.safe}>
      <ScholarBackground performance="reduced" />
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable><Text style={styles.brand}>SCHOLAR</Text></View>
      <View style={styles.content}>
        <GlassCard elevated style={styles.card}>
          <View style={styles.icon}><Ionicons name={feature?.icon ?? "sparkles-outline"} size={26} color={colors.text} /></View>
          {feature?.badge ? <Text style={styles.badge}>{feature.badge === "PLUS" ? "SCHOLAR PLUS" : feature.badge}</Text> : null}
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.copy}>This Scholar web section is coming to Android in a later migration phase. Its navigation is real; its functionality has not been fabricated.</Text>
          <Pressable onPress={() => router.replace("/(tabs)/home")} style={styles.button}><Text style={styles.buttonText}>Return to Dashboard</Text><Ionicons name="arrow-forward" size={16} color={colors.background} /></Pressable>
        </GlassCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { height: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.glass, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  brand: { color: colors.text, fontFamily: fonts.semibold, fontSize: typography.caption, letterSpacing: 2.4 },
  content: { flex: 1, justifyContent: "center", padding: spacing.xl },
  card: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl },
  icon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.glassHighlight },
  badge: { color: colors.gold, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.6 },
  title: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: 31, textAlign: "center" },
  copy: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: typography.caption, lineHeight: 20, textAlign: "center", maxWidth: 300 },
  button: { marginTop: spacing.md, minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.text },
  buttonText: { color: colors.background, fontFamily: fonts.semibold, fontSize: typography.caption },
});
