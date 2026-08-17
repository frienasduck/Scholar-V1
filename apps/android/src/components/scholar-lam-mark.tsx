import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";

export function ScholarLamMark({ size = 28 }: { size?: number }) {
  const oval = { width: size * 0.8, height: size * 0.34, borderRadius: size / 2 };
  return <View style={[styles.mark, { width: size, height: size }]}><View style={[styles.oval, oval]} /><View style={[styles.oval, oval, { transform: [{ rotate: "60deg" }], opacity: 0.62 }]} /><View style={[styles.oval, oval, { transform: [{ rotate: "-60deg" }], opacity: 0.62 }]} /></View>;
}

const styles = StyleSheet.create({ mark: { alignItems: "center", justifyContent: "center" }, oval: { position: "absolute", borderWidth: 1.4, borderColor: colors.text } });
