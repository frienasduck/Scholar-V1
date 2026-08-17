import React, { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getIntelligenceSnapshot, type IntelligenceSnapshot } from "@/api/dashboard";
import { GlassCard } from "@/components/glass-card";
import { ScholarBackground } from "@/components/scholar-background";
import { ScholarMetric } from "@/components/scholar-metric";
import { ScholarSectionHeader } from "@/components/scholar-section-header";
import { ScholarTopBar } from "@/components/scholar-top-bar";
import { useAuth } from "@/hooks/use-auth";
import { colors, fonts, radius, spacing, typography } from "@/theme";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const QUICK_ACTIONS = [
  { key: "lam", label: "Ask LAM", note: "Learning assistant", icon: "sparkles-outline" as const, route: "/(tabs)/lam" },
  { key: "study", label: "Start Study", note: "Browse your syllabus", icon: "book-outline" as const, route: "/(tabs)/study" },
  { key: "notes", label: "Open Notes", note: "Your learning library", icon: "document-text-outline" as const, route: "/(tabs)/library" },
  { key: "practice", label: "Practice", note: "Coming to Android", icon: "checkbox-outline" as const, route: "/feature/practice" },
];

export function HomeScreen() {
  const router = useRouter();
  const { user, session, refreshSession } = useAuth();
  const [intelligence, setIntelligence] = useState<IntelligenceSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [intelligenceUnavailable, setIntelligenceUnavailable] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [, snapshot] = await Promise.all([refreshSession(), getIntelligenceSnapshot()]);
      setIntelligence(snapshot);
      setIntelligenceUnavailable(false);
    } catch {
      setIntelligenceUnavailable(true);
    } finally {
      if (manual) setRefreshing(false);
    }
  }, [refreshSession]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const firstName = user?.name?.split(" ")[0] ?? "Scholar";
  const plan = session?.plan === "PLUS" ? "Plus" : session?.plan === "DEVELOPER" ? "Developer" : session?.plan ?? "Free";
  const date = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const subjectMastery = useMemo(() => {
    if (!intelligence) return [];
    const grouped = new Map<string, { total: number; count: number; evidence: number }>();
    intelligence.mastery.filter((item) => !item.chapter && !item.topic && item.evidenceCount > 0 && item.score !== null).forEach((item) => grouped.set(item.subject, { total: item.score ?? 0, count: 1, evidence: item.evidenceCount }));
    return [...grouped].map(([subject, value]) => ({ subject, percent: Math.round((value.total / value.count) * 100), evidence: value.evidence }));
  }, [intelligence]);
  const overallMastery = subjectMastery.length ? Math.round(subjectMastery.reduce((sum, item) => sum + item.percent, 0) / subjectMastery.length) : null;
  const storage = session?.storage;
  const storageLabel = storage ? `${Math.round(storage.usedBytes / 1_048_576)} MB` : "—";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScholarBackground />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.text} />}>
        <ScholarTopBar />
        <View style={styles.hero}>
          <View style={styles.identity}><Text style={styles.identityText}>{firstName.toUpperCase()}&apos;S SCHOLAR</Text><Text style={styles.date}>{date}</Text></View>
          <View style={styles.greetingPill}><Text style={styles.greeting}>{greeting()}, {firstName.toUpperCase()} · CLASS {user?.currentScholarClass ?? "—"} CBSE</Text></View>
          <Text style={styles.heroTitle}>WITNESS YOUR{`\n`}GROWTH UNFOLD</Text>
          <Text style={styles.heroBody}>An odyssey through your study journey, revealed by real Scholar data and curiosity.</Text>
        </View>

        <View style={styles.metrics}>
          <ScholarMetric icon="school-outline" label="Class" value={String(user?.currentScholarClass ?? "—")} note="CBSE profile" />
          <ScholarMetric icon="disc-outline" label="Coins" value={user ? String(user.coins) : "—"} note="Scholar balance" />
          <ScholarMetric icon="diamond-outline" label="Plan" value={plan} note="Server verified" />
          <ScholarMetric icon="folder-outline" label="Storage" value={storageLabel} note="Account usage" />
          {overallMastery !== null ? <ScholarMetric icon="analytics-outline" label="Mastery" value={`${overallMastery}%`} note={`${intelligence?.evidenceCount ?? 0} evidence events`} /> : null}
        </View>

        <ScholarSectionHeader eyebrow="Continue learning" title="Your Scholar tools" />
        <View style={styles.actions}>{QUICK_ACTIONS.map((action) => <Pressable key={action.key} onPress={() => router.push(action.route as never)} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}><View style={styles.actionIcon}><Ionicons name={action.icon} size={19} color={colors.text} /></View><View style={styles.actionCopy}><Text style={styles.actionLabel}>{action.label}</Text><Text style={styles.actionNote}>{action.note}</Text></View><Ionicons name="arrow-forward" size={16} color={colors.textMuted} /></Pressable>)}</View>

        <ScholarSectionHeader eyebrow="Scholar Intelligence" title="Subject mastery" />
        {subjectMastery.length ? <GlassCard style={styles.listCard}>{subjectMastery.map((item) => <View key={item.subject} style={styles.masteryRow}><View style={styles.masteryCopy}><Text style={styles.masterySubject}>{item.subject}</Text><Text style={styles.masteryEvidence}>{item.evidence} evidence events</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${item.percent}%` }]} /></View><Text style={styles.masteryValue}>{item.percent}%</Text></View>)}</GlassCard> : <GlassCard style={styles.emptyCard}><Ionicons name="analytics-outline" size={20} color={colors.textMuted} /><View style={styles.emptyCopy}><Text style={styles.emptyTitle}>{intelligenceUnavailable ? "Intelligence is temporarily unavailable" : "No mastery evidence yet"}</Text><Text style={styles.emptyText}>{intelligenceUnavailable ? "Pull to refresh when Scholar is reachable." : "Complete synced practice on Scholar web; verified mastery will appear here."}</Text></View></GlassCard>}

        {intelligence?.weakTopics?.length ? <><ScholarSectionHeader eyebrow="Revision signal" title="Topics to revisit" /><GlassCard style={styles.listCard}>{intelligence.weakTopics.slice(0, 4).map((topic, index) => <View key={`${topic.subject}-${topic.topic ?? topic.chapter ?? index}`} style={styles.weakRow}><View style={styles.weakIndex}><Text style={styles.weakIndexText}>{index + 1}</Text></View><View style={styles.weakCopy}><Text style={styles.masterySubject}>{topic.topic ?? topic.chapter ?? topic.subject}</Text><Text style={styles.masteryEvidence}>{topic.subject}{topic.suggestion ? ` · ${topic.suggestion}` : ""}</Text></View></View>)}</GlassCard></> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, content: { paddingHorizontal: spacing.lg, paddingBottom: 112, gap: spacing.xl },
  hero: { alignItems: "center", paddingTop: spacing.lg, gap: spacing.lg }, identity: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  identityText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9, letterSpacing: 1.5 }, date: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: typography.tiny },
  greetingPill: { borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.glass, borderColor: colors.borderStrong, borderWidth: StyleSheet.hairlineWidth },
  greeting: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1.05, textAlign: "center" },
  heroTitle: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: 39, lineHeight: 41, letterSpacing: -1, textAlign: "center" },
  heroBody: { maxWidth: 320, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: typography.caption, lineHeight: 19, textAlign: "center" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md }, actions: { gap: spacing.sm },
  action: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.glass, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  actionPressed: { backgroundColor: colors.glassStrong, transform: [{ scale: 0.99 }] }, actionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.glassHighlight },
  actionCopy: { flex: 1, gap: 2 }, actionLabel: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.label }, actionNote: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: typography.tiny },
  listCard: { gap: spacing.md }, masteryRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm }, masteryCopy: { width: 104, gap: 2 }, masterySubject: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.caption }, masteryEvidence: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  track: { flex: 1, height: 5, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.glassHighlight }, fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.textSecondary }, masteryValue: { width: 34, color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: typography.tiny, textAlign: "right" },
  emptyCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md }, emptyCopy: { flex: 1, gap: spacing.xs }, emptyTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.label }, emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: typography.caption, lineHeight: 18 },
  weakRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.md }, weakIndex: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.glassHighlight }, weakIndexText: { color: colors.textSecondary, fontFamily: fonts.bold, fontSize: typography.tiny }, weakCopy: { flex: 1, gap: 2 },
});
