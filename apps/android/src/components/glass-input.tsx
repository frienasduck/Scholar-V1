/**
 * GlassInput — labelled glass text field.
 */
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, typography } from "@/theme";

interface GlassInputProps extends Omit<TextInputProps, "style"> {
  label: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
}

export function GlassInput({ label, secure = false, ...rest }: GlassInputProps) {
  const [hidden, setHidden] = useState(secure);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          {...rest}
        />
        {secure && (
          <Pressable onPress={() => setHidden((value) => !value)} hitSlop={10}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs + 2,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    letterSpacing: 0.2,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.025)",
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    height: 50,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    paddingVertical: 0,
  },
});
