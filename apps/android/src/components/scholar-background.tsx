import React, { useEffect, useState } from "react";
import { AccessibilityInfo, AppState, StyleSheet, View, type AppStateStatus } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { colors } from "@/theme";

export type BackgroundPerformanceMode = "full" | "reduced" | "static";

export function ScholarBackground({ warm = false, performance = "full" }: { warm?: boolean; performance?: BackgroundPerformanceMode }) {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [reduceMotion, setReduceMotion] = useState(false);
  const drift = useSharedValue(0);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const motionSubscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    const appSubscription = AppState.addEventListener("change", setAppState);
    return () => { motionSubscription.remove(); appSubscription.remove(); };
  }, []);

  const effectiveMode: BackgroundPerformanceMode = appState !== "active" || reduceMotion || performance === "static" ? "static" : performance;
  useEffect(() => {
    if (effectiveMode === "static") { cancelAnimation(drift); drift.value = 0; return; }
    drift.value = withRepeat(withTiming(1, { duration: effectiveMode === "reduced" ? 26000 : 18000, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(drift);
  }, [effectiveMode, drift]);

  const topStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value * -28 }, { translateY: drift.value * 18 }, { scale: 1 + drift.value * 0.07 }] }));
  const leafStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value * 18 }, { rotate: `${-10 + drift.value * 4}deg` }] }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={["#020407", warm ? "#120d0a" : "#091127", colors.background]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.skyOrb, warm && styles.warmOrb, topStyle]} />
      <Animated.View style={[styles.leaf, styles.leafLeft, leafStyle]} />
      <Animated.View style={[styles.leaf, styles.leafRight, leafStyle]} />
      <View style={styles.starA} /><View style={styles.starB} /><View style={styles.starC} />
      <LinearGradient colors={["rgba(0,0,0,0.06)", "rgba(0,0,0,0.44)", "rgba(0,0,0,0.78)"]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  skyOrb: { position: "absolute", width: 520, height: 420, borderRadius: 260, top: -80, right: -230, backgroundColor: "rgba(74,83,170,0.24)", shadowColor: "#8196ff", shadowOpacity: 0.35, shadowRadius: 70, elevation: 2 },
  warmOrb: { backgroundColor: "rgba(163,107,56,0.22)", shadowColor: "#c18454" },
  leaf: { position: "absolute", width: 130, height: 350, borderRadius: 80, bottom: -190, backgroundColor: "rgba(9,28,27,0.68)" },
  leafLeft: { left: -38 },
  leafRight: { right: -30, transform: [{ rotate: "18deg" }] },
  starA: { position: "absolute", width: 2, height: 2, borderRadius: 1, top: 120, left: 46, backgroundColor: "rgba(219,234,254,0.4)" },
  starB: { position: "absolute", width: 2, height: 2, borderRadius: 1, top: 210, right: 84, backgroundColor: "rgba(219,234,254,0.3)" },
  starC: { position: "absolute", width: 1, height: 1, borderRadius: 1, top: 340, left: 126, backgroundColor: "rgba(219,234,254,0.3)" },
});
