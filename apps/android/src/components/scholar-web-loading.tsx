import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export function ScholarWebLoading() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.wordmark}>Scholar</Text>
      <ActivityIndicator color="#8b5cf6" size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    alignItems: "center",
    backgroundColor: "#050506",
    gap: 22,
    justifyContent: "center",
    zIndex: 10,
  },
  wordmark: {
    color: "#f7f7fb",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -1,
  },
});
