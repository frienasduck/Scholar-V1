import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          animation: "none",
          contentStyle: { backgroundColor: "#050506" },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
      <NavigationBar hidden={false} style="dark" />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
