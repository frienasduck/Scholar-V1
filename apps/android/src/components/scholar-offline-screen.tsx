import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = { onRetry: () => void };

export function ScholarOfflineScreen({ onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cannot connect to Scholar</Text>
      <Text style={styles.body}>Check your connection, then try again.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Retry</Text>
      </Pressable>
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
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 20,
  },
  title: { color: "#ffffff", fontSize: 22, fontWeight: "700", textAlign: "center" },
  body: { color: "#a7a7b2", fontSize: 15, marginTop: 10, textAlign: "center" },
  button: {
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    marginTop: 26,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
});
