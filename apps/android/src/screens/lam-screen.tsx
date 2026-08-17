import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { lamChat } from "@/api/lam";
import { GlassCard } from "@/components/glass-card";
import { ScholarBackground } from "@/components/scholar-background";
import { ScholarLamMark } from "@/components/scholar-lam-mark";
import { ScholarTopBar } from "@/components/scholar-top-bar";
import { useAuth } from "@/hooks/use-auth";
import type { LamChatMessage, LamMode, LamStreamEvent } from "@/types/lam";
import { colors, fonts, radius, spacing, typography } from "@/theme";

type ChatItem = LamChatMessage & { id: string; streaming?: boolean; error?: boolean };
type LamState = "idle" | "thinking" | "answering" | "error";
const MODES: Array<{ id: LamMode; label: string }> = [{ id: "general", label: "General" }, { id: "tutor", label: "Tutor" }, { id: "doubt-solver", label: "Doubt Solver" }, { id: "quiz-master", label: "Quiz Master" }];
const QUICK = ["Plan my study today", "Explain a difficult concept", "Quiz me"];

function friendlyLamError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your Scholar session expired. Sign in again to continue.";
    if (error.status === 429) return "LAM is receiving too many requests. Try again shortly.";
    if (error.status === 0) return "LAM cannot reach Scholar. Check your connection and try again.";
    if (error.status >= 500) return "LAM's provider is temporarily unavailable. Your conversation is still here.";
    return error.message;
  }
  return error instanceof Error ? error.message : "LAM could not complete that response.";
}

export function LamScreen() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<LamMode>("general");
  const [state, setState] = useState<LamState>("idle");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList<ChatItem>>(null);
  const accountIdRef = useRef(user?.id);

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (accountIdRef.current !== user?.id) {
      controllerRef.current?.abort();
      setMessages([]);
      setDraft("");
      setError(null);
      setState("idle");
      accountIdRef.current = user?.id;
    }
  }, [user?.id]);

  const conversation = useMemo<LamChatMessage[]>(() => messages.filter((item) => !item.error && item.content.trim()).map(({ role, content }) => ({ role, content })).slice(-12), [messages]);

  const send = useCallback(async (preset?: string) => {
    const text = (preset ?? draft).trim();
    if (!text || state === "thinking" || state === "answering" || !user) return;
    const history = conversation;
    const requestId = `lam-${Date.now()}`;
    const userItem: ChatItem = { id: `${requestId}-user`, role: "user", content: text };
    const assistantId = `${requestId}-assistant`;
    setMessages((current) => [...current, userItem, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    setDraft(""); setError(null); setState("thinking");
    void Haptics.selectionAsync();
    const controller = new AbortController();
    controllerRef.current = controller;
    const onEvent = (event: LamStreamEvent) => {
      if (event.type === "start") setState("thinking");
      if (event.type === "text-delta") {
        setState("answering");
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + event.value } : item));
      }
      if (event.type === "finish") setState("idle");
    };
    try {
      await lamChat({
        profileId: `class-${user.currentScholarClass}`,
        message: text,
        inputMode: "text",
        assistantMode: mode,
        pageContext: { profileId: `class-${user.currentScholarClass}`, profileName: user.name ?? "Scholar", scholarClass: user.currentScholarClass, currentView: "lam", currentRoute: "/(tabs)/lam" },
        messages: history,
        responseDetail: "balanced",
      }, { signal: controller.signal, onEvent });
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, streaming: false } : item));
      setState("idle");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      if (controller.signal.aborted) {
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, streaming: false, content: item.content || "Response cancelled." } : item));
        setState("idle");
      } else {
        const message = friendlyLamError(caught);
        setError(message);
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, streaming: false, error: true, content: item.content || message } : item));
        setState("error");
      }
    } finally { controllerRef.current = null; }
  }, [conversation, draft, mode, state, user]);

  const cancel = () => { controllerRef.current?.abort(); controllerRef.current = null; };
  const clear = () => { cancel(); setMessages([]); setError(null); setState("idle"); };
  const lastUser = [...messages].reverse().find((item) => item.role === "user")?.content;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScholarBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 18}>
        <View style={styles.header}><ScholarTopBar /><View style={styles.lamTitle}><View style={styles.mark}><ScholarLamMark size={31} /></View><View style={styles.titleCopy}><Text style={styles.eyebrow}>LEARNING ASSISTANT & MENTOR</Text><Text style={styles.title}>LAM</Text></View><Pressable accessibilityLabel="New conversation" onPress={clear} style={styles.clear}><Ionicons name="add" size={21} color={colors.textSecondary} /></Pressable></View>
          <View style={styles.modeRow}>{MODES.map((item) => <Pressable key={item.id} onPress={() => setMode(item.id)} style={[styles.modeChip, mode === item.id && styles.modeActive]}><Text style={[styles.modeText, mode === item.id && styles.modeTextActive]}>{item.label}</Text></Pressable>)}</View>
        </View>

        <FlatList ref={listRef} data={messages} keyExtractor={(item) => item.id} contentContainerStyle={[styles.messages, messages.length === 0 && styles.emptyMessages]} keyboardShouldPersistTaps="handled" onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })} renderItem={({ item }) => <View style={[styles.message, item.role === "user" ? styles.userMessage : styles.assistantMessage, item.error && styles.errorMessage]}>{item.role === "assistant" ? <View style={styles.assistantLabel}><ScholarLamMark size={18} /><Text style={styles.assistantLabelText}>LAM {item.streaming ? "· RESPONDING" : "· ANSWER"}</Text></View> : null}<Text selectable style={styles.messageText}>{item.content || (item.streaming ? "Thinking…" : "")}</Text></View>} ListEmptyComponent={<View style={styles.empty}><View style={styles.heroMark}><ScholarLamMark size={68} /></View><Text style={styles.emptyTitle}>How can LAM help?</Text><Text style={styles.emptyCopy}>Ask from your Class {user?.currentScholarClass ?? "—"} context. LAM streams answers from Scholar&apos;s real backend.</Text><View style={styles.quick}>{QUICK.map((prompt) => <Pressable key={prompt} onPress={() => void send(prompt)} style={styles.quickChip}><Text style={styles.quickText}>{prompt}</Text><Ionicons name="arrow-forward" size={14} color={colors.textMuted} /></Pressable>)}</View></View>} />

        {error ? <View style={styles.errorBar}><Ionicons name="alert-circle-outline" size={17} color={colors.danger} /><Text style={styles.errorText}>{error}</Text>{lastUser ? <Pressable onPress={() => void send(lastUser)}><Text style={styles.retry}>Retry</Text></Pressable> : null}</View> : null}
        <GlassCard elevated style={styles.composer}>
          <TextInput value={draft} onChangeText={setDraft} editable={state !== "thinking" && state !== "answering"} placeholder="Ask LAM anything…" placeholderTextColor={colors.textMuted} multiline maxLength={4000} style={styles.input} onSubmitEditing={() => void send()} blurOnSubmit={false} />
          {state === "thinking" || state === "answering" ? <Pressable accessibilityLabel="Cancel response" onPress={cancel} style={styles.send}><Ionicons name="stop" size={15} color={colors.background} /></Pressable> : <Pressable accessibilityLabel="Send to LAM" disabled={!draft.trim()} onPress={() => void send()} style={[styles.send, !draft.trim() && styles.sendDisabled]}><Ionicons name="arrow-up" size={17} color={colors.background} /></Pressable>}
        </GlassCard>
        <Text style={styles.planNote}>{session?.plan === "PLUS" ? "SCHOLAR PLUS · SERVER VERIFIED" : `${session?.plan ?? "FREE"} PLAN · SERVER VERIFIED`}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, header: { paddingHorizontal: spacing.lg },
  lamTitle: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md }, mark: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.glassStrong, borderColor: colors.borderStrong, borderWidth: StyleSheet.hairlineWidth },
  titleCopy: { flex: 1, marginLeft: spacing.md }, eyebrow: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 1.45 }, title: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: 31 }, clear: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.glass },
  modeRow: { flexDirection: "row", gap: 6, paddingBottom: spacing.sm }, modeChip: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.glass, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }, modeActive: { backgroundColor: "rgba(129,140,248,0.12)", borderColor: "rgba(165,180,252,0.25)" }, modeText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 9 }, modeTextActive: { color: colors.text },
  messages: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }, emptyMessages: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl }, heroMark: { width: 116, height: 116, alignItems: "center", justifyContent: "center", borderRadius: 38, backgroundColor: "rgba(15,19,30,0.74)", borderColor: colors.borderStrong, borderWidth: StyleSheet.hairlineWidth }, emptyTitle: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: 30 }, emptyCopy: { maxWidth: 310, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: typography.caption, lineHeight: 19, textAlign: "center" }, quick: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.sm }, quickChip: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.glass, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }, quickText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: typography.caption },
  message: { maxWidth: "92%", padding: spacing.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth }, userMessage: { alignSelf: "flex-end", backgroundColor: "rgba(99,102,241,0.13)", borderColor: "rgba(165,180,252,0.18)" }, assistantMessage: { alignSelf: "flex-start", backgroundColor: colors.glassStrong, borderColor: colors.border }, errorMessage: { borderColor: "rgba(248,113,113,0.3)" }, assistantLabel: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: spacing.sm }, assistantLabelText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.2 }, messageText: { color: colors.text, fontFamily: fonts.regular, fontSize: typography.label, lineHeight: 21 },
  errorBar: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(248,113,113,0.08)" }, errorText: { flex: 1, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: typography.tiny }, retry: { color: colors.text, fontFamily: fonts.bold, fontSize: typography.tiny },
  composer: { marginHorizontal: spacing.lg, marginBottom: spacing.xs, minHeight: 58, flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.sm, paddingLeft: spacing.lg }, input: { flex: 1, maxHeight: 116, minHeight: 40, color: colors.text, fontFamily: fonts.regular, fontSize: typography.label, paddingVertical: 9 }, send: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.text }, sendDisabled: { opacity: 0.32 }, planNote: { marginBottom: 78, color: colors.textMuted, fontFamily: fonts.bold, fontSize: 7, letterSpacing: 1.2, textAlign: "center" },
});
