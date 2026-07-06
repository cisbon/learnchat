import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AppProvider } from "@/contexts/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { COLORS } from "@/constants/theme";

const DevErrorBoundary = __DEV__
  ? ErrorBoundary
  : ({ children }: { children: React.ReactNode }) => <>{children}</>;

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: COLORS.primary,
      background: COLORS.background,
      card: COLORS.surface,
      text: COLORS.text,
      border: COLORS.border,
      notification: COLORS.error,
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: COLORS.primary,
      background: '#0F0F1A',
      card: '#1A1A2E',
      text: '#F0F0FF',
      border: 'rgba(108,99,255,0.15)',
      notification: COLORS.error,
    },
  };

  return (
    <DevErrorBoundary>
      <StatusBar style="auto" animated />
      <ThemeProvider value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}>
        <SafeAreaProvider>
          <AppProvider>
            <WidgetProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <Stack>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                  <Stack.Screen name="settings" options={{ headerShown: false }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <SystemBars style={"auto"} />
              </GestureHandlerRootView>
            </WidgetProvider>
          </AppProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </DevErrorBoundary>
  );
}
