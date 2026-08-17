/**
 * GlassButton — primary gradient button and secondary glass button.
 */
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, typography } from "@/theme";

type Variant = "primary" | "secondary" | "danger";

interface GlassButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  arrow?: boolean;
}

export function GlassButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  arrow = false,
}: GlassButtonProps) {
  const inactive = disabled || loading;

  if (variant === "primary") {
    return (
      <Pressable
        onPress={onPress}
        disabled={inactive}
        style={({ pressed }) => [style, pressed && !inactive && styles.pressed]}
      >
        <View style={[styles.button, inactive && styles.buttonInactive]}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <View style={styles.labelRow}><Text style={[styles.label, inactive && styles.labelInactive]}>{label}</Text>{arrow ? <Ionicons name="arrow-up" size={16} color={colors.text} style={styles.arrow} /> : null}</View>
          )}
        </View>
      </Pressable>
    );
  }

  const danger = variant === "danger";
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.secondary,
        danger && styles.dangerBorder,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={danger ? colors.danger : colors.text} />
      ) : (
        <Text style={[styles.label, danger ? styles.dangerText : styles.secondaryLabel, inactive && styles.labelInactive]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  buttonInactive: { backgroundColor: colors.glass },
  secondary: {
    height: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glass,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dangerBorder: {
    borderColor: "rgba(248, 113, 113, 0.35)",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  label: {
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: typography.label,
    letterSpacing: 0.1,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  arrow: { transform: [{ rotate: "45deg" }] },
  secondaryLabel: {
    color: colors.text,
  },
  dangerText: {
    color: colors.danger,
  },
  labelInactive: {
    opacity: 0.5,
  },
});
