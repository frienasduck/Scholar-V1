import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassButton } from "@/components/glass-button";
import { GlassCard } from "@/components/glass-card";
import { GlassInput } from "@/components/glass-input";
import { LogoMark } from "@/components/logo-mark";
import { ScholarBackground } from "@/components/scholar-background";
import { useAuth } from "@/hooks/use-auth";
import { colors, fonts, radius, spacing, typography } from "@/theme";
import type { ApiError } from "@/api/client";
import { SafeAreaView } from "react-native-safe-area-context";
import { getLastEmail } from "@/storage/app-storage";

type Mode = "signin" | "signup";

export function LoginScreen() {
  const { login, register, apiUrl, apiConfigured, error } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { if (error) setFormError(error); }, [error]);
  useEffect(() => { void getLastEmail().then((value) => { if (value) setEmail(value); }); }, []);

  const submit = async () => {
    setFormError(null);
    if (!apiConfigured) { setFormError("Scholar server is not configured."); return; }
    if (mode === "signup" && name.trim().length < 1) { setFormError("Enter your name."); return; }
    if (!email.trim() || password.length === 0) { setFormError("Enter your email and password."); return; }
    setBusy(true);
    try {
      if (mode === "signin") await login(email, password);
      else await register(name, email, password);
    } catch (caught) {
      setFormError(caught instanceof Error && "status" in caught ? (caught as ApiError).message : caught instanceof Error ? caught.message : "Sign-in failed. Try again.");
    } finally { setBusy(false); }
  };

  const switchMode = () => { setMode((value) => value === "signin" ? "signup" : "signin"); setFormError(null); };

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScholarBackground warm />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}><LogoMark size={66} /><Text style={styles.brand}>SCHOLAR</Text></View>

        <View style={styles.hero}>
          <View style={styles.badge}><Text style={styles.badgeNew}>NEW</Text><Text style={styles.badgeText}>AI-POWERED STUDY OS</Text></View>
          <Text style={styles.heroTitle}>Learn Past Your Limits{`\n`}Across the Syllabus</Text>
          <Text style={styles.heroBody}>The same Scholar account, study identity, and secure session—adapted for Android.</Text>
        </View>

        <GlassCard elevated style={styles.card}>
          <View style={styles.cardHeading}>
            <Text style={styles.cardTitle}>{mode === "signin" ? "Welcome back" : "Begin your journey"}</Text>
            <Text style={styles.cardSubtitle}>{mode === "signin" ? "Sign in to continue learning" : "Create your study account"}</Text>
          </View>

          {mode === "signup" ? <GlassInput label="Full Name" value={name} onChangeText={setName} placeholder="Neha Salah" autoCapitalize="words" /> : null}
          <GlassInput label="Email" value={email} onChangeText={setEmail} placeholder="you@scholar.app" keyboardType="email-address" autoComplete="email" />
          <GlassInput label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secure autoComplete="password" onSubmitEditing={submit} />

          {formError ? <View style={styles.errorRow}><Ionicons name="alert-circle-outline" size={16} color={colors.danger} /><Text style={styles.errorText}>{formError}</Text></View> : null}

          <GlassButton label={mode === "signin" ? "Sign In" : "Create Account"} onPress={submit} loading={busy} arrow />
          <Pressable onPress={switchMode} style={styles.switchButton}>
            <Text style={styles.switchText}>{mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}</Text>
          </Pressable>
          <Text style={styles.secureNote}>Your Scholar account is protected by a secure server session.</Text>
          {!apiConfigured ? <Text style={styles.serverError}>Server URL not configured</Text> : <Text style={styles.server} numberOfLines={1}>{apiUrl}</Text>}
        </GlassCard>

        <View style={styles.partners}><Text style={styles.partner}>NCERT</Text><Text style={styles.partner}>CBSE</Text><Text style={styles.partner}>AI</Text><Text style={styles.partner}>SMART</Text></View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  brand: { color: colors.text, fontFamily: fonts.medium, fontSize: typography.caption, letterSpacing: 3 },
  hero: { alignItems: "center", gap: spacing.lg, paddingTop: spacing.md },
  badge: { flexDirection: "row", alignItems: "center", borderRadius: radius.pill, padding: 4, paddingRight: 12, gap: 9, backgroundColor: colors.glass, borderColor: colors.borderStrong, borderWidth: StyleSheet.hairlineWidth },
  badgeNew: { color: colors.background, backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, fontFamily: fonts.semibold, fontSize: 9 },
  badgeText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1.1 },
  heroTitle: { color: colors.text, fontFamily: fonts.displayMediumItalic, fontSize: 36, lineHeight: 38, letterSpacing: -1.4, textAlign: "center" },
  heroBody: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: typography.caption, lineHeight: 19, textAlign: "center", maxWidth: 320 },
  card: { gap: spacing.lg, padding: spacing.xl },
  cardHeading: { alignItems: "center", gap: 4, marginBottom: spacing.xs },
  cardTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 30 },
  cardSubtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: typography.caption },
  errorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  errorText: { flex: 1, color: colors.danger, fontFamily: fonts.regular, fontSize: typography.caption },
  switchButton: { alignItems: "center", paddingVertical: spacing.xs },
  switchText: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: typography.caption },
  secureNote: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: typography.tiny, lineHeight: 15, textAlign: "center" },
  server: { color: "rgba(255,255,255,0.22)", fontFamily: fonts.regular, fontSize: 8, textAlign: "center" },
  serverError: { color: colors.danger, fontFamily: fonts.regular, fontSize: typography.tiny, textAlign: "center" },
  partners: { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.sm },
  partner: { color: colors.textSecondary, fontFamily: fonts.display, fontStyle: "italic", fontSize: typography.body },
});
