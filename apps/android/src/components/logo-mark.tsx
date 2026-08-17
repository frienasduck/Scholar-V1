/**
 * Scholar logo mark — gradient orb with a white spark, matching the app icon.
 */
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Text } from "react-native";
import { colors, fonts } from "@/theme";

interface LogoMarkProps {
  size?: number;
  animate?: boolean;
}

export function LogoMark({ size = 96, animate = false }: LogoMarkProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {animate && (
        <Animated.View
          style={[
            styles.halo,
            {
              width: size * 0.86,
              height: size * 0.86,
              borderRadius: size * 0.43,
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
      )}
      <View style={[styles.orb, { width: size * 0.66, height: size * 0.66, borderRadius: size * 0.33 }]}><Text style={[styles.letter, { fontSize: size * 0.34 }]}>n</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  orb: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glass,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  letter: { color: colors.text, fontFamily: fonts.display, fontStyle: "italic" },
});
