import React, { useMemo, useRef, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SCHOLAR_NAV_ITEMS, routeForScholarItem } from "@/navigation/scholar-navigation";
import { useScholarShell } from "@/navigation/scholar-shell-context";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export function ScholarSearch() {
  const { searchOpen, closeSearch } = useScholarShell();
  const [query, setQuery] = useState("");
  const input = useRef<TextInput>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? SCHOLAR_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(normalized)).slice(0, 10) : [];
  }, [query]);

  React.useEffect(() => {
    if (!searchOpen) { setQuery(""); return; }
    const timer = setTimeout(() => input.current?.focus(), 180);
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { closeSearch(); return true; });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [searchOpen, closeSearch]);

  const select = (route: string) => {
    closeSearch();
    requestAnimationFrame(() => router.push(route as never));
  };

  return (
    <Modal visible={searchOpen} transparent animationType="fade" onRequestClose={closeSearch} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={closeSearch} />
        <View style={[styles.panel, { marginTop: insets.top + spacing.md }]}>
          <View style={styles.field}>
            <Ionicons name="search" size={19} color={colors.textMuted} />
            <TextInput ref={input} value={query} onChangeText={setQuery} placeholder="Search or jump to…" placeholderTextColor={colors.textMuted} style={styles.input} returnKeyType="search" autoCorrect={false} />
            <Pressable onPress={closeSearch} hitSlop={10}><Ionicons name="close-circle" size={20} color={colors.textMuted} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results}>
            {!query ? <View style={styles.empty}><Text style={styles.eyebrow}>RECENT</Text><Text style={styles.emptyText}>Your recent Scholar destinations will appear here.</Text></View> : null}
            {query && results.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>No Scholar section matches “{query}”.</Text></View> : null}
            {results.map((item) => <Pressable key={item.id} onPress={() => select(routeForScholarItem(item))} style={styles.result}><Ionicons name={item.icon} size={18} color={colors.textSecondary} /><Text style={styles.resultText}>{item.label}</Text><Ionicons name="arrow-forward" size={15} color={colors.textMuted} /></Pressable>)}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, alignItems: "center", paddingHorizontal: spacing.md },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.78)" },
  panel: { width: "100%", maxWidth: 560, maxHeight: "72%", overflow: "hidden", borderRadius: radius.xl, backgroundColor: "rgba(12,14,21,0.98)", borderColor: colors.borderStrong, borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOpacity: 0.7, shadowRadius: 28, elevation: 24 },
  field: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: typography.body },
  results: { padding: spacing.sm },
  empty: { padding: spacing.xl, gap: spacing.sm },
  eyebrow: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.8 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: typography.caption, lineHeight: 18 },
  result: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md },
  resultText: { flex: 1, color: colors.textSecondary, fontFamily: fonts.medium, fontSize: typography.label },
});
