import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Linking,
  Platform,
  Share,
  StyleSheet,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type {
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview";
import { createNativeMessage, parseWebToNativeMessage } from "@/bridge/protocol";
import {
  createScholarAndroidBootstrapScript,
  SCHOLAR_BRIDGE_SCRIPT,
} from "@/bridge/injected-script";
import { ScholarOfflineScreen } from "@/components/scholar-offline-screen";
import { ScholarWebLoading } from "@/components/scholar-web-loading";
import {
  isAllowedWebViewUrl,
  isTrustedScholarUrl,
  SCHOLAR_WEB_URL,
} from "@/webview/config";

const ALLOWED_EXTERNAL_SCHEMES = new Set(["https:", "http:", "mailto:", "tel:"]);
type WebViewProps = React.ComponentProps<typeof WebView>;
type ShouldStartRequest = Parameters<NonNullable<WebViewProps["onShouldStartLoadWithRequest"]>>[0];
type HttpErrorEvent = Parameters<NonNullable<WebViewProps["onHttpError"]>>[0];
type OpenWindowEvent = Parameters<NonNullable<WebViewProps["onOpenWindow"]>>[0];

function openExternalUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_EXTERNAL_SCHEMES.has(parsed.protocol)) return;
    void Linking.openURL(url);
  } catch {
    // Malformed and non-whitelisted URLs are intentionally ignored.
  }
}

export function ScholarWebScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const hasOverlayRef = useRef(false);
  const mainUrlRef = useRef(SCHOLAR_WEB_URL);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const bootstrapScript = useMemo(
    () => createScholarAndroidBootstrapScript(insets.bottom),
    [insets.bottom],
  );

  const sendToWeb = useCallback((message: string) => {
    webViewRef.current?.postMessage(message);
  }, []);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (hasOverlayRef.current) {
        sendToWeb(createNativeMessage("NATIVE_BACK", {}));
        return true;
      }
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      sendToWeb(createNativeMessage("APP_STATE", { state }));
    });

    return () => {
      backSubscription.remove();
      appStateSubscription.remove();
    };
  }, [sendToWeb]);

  const handleNavigation = useCallback((navigation: WebViewNavigation) => {
    canGoBackRef.current = navigation.canGoBack;
    if (isTrustedScholarUrl(navigation.url)) mainUrlRef.current = navigation.url;
  }, []);

  const handleShouldStart = useCallback((request: ShouldStartRequest) => {
    if (isAllowedWebViewUrl(request.url)) return true;
    if (request.isTopFrame) openExternalUrl(request.url);
    return false;
  }, []);

  const handleOpenWindow = useCallback((event: OpenWindowEvent) => {
    const url = event.nativeEvent.targetUrl;
    if (isTrustedScholarUrl(url)) {
      webViewRef.current?.injectJavaScript(
        `window.location.assign(${JSON.stringify(url)}); true;`,
      );
      return;
    }
    openExternalUrl(url);
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    if (!isTrustedScholarUrl(event.nativeEvent.url)) return;
    const message = parseWebToNativeMessage(event.nativeEvent.data);
    if (!message) return;

    switch (message.type) {
      case "WEB_READY":
        if (isTrustedScholarUrl(message.payload.url)) {
          sendToWeb(createNativeMessage("SAFE_AREA", { bottom: insets.bottom }));
          setIsLoading(false);
        }
        break;
      case "UI_STATE":
        hasOverlayRef.current = message.payload.hasOverlay;
        break;
      case "HAPTIC":
        if (message.payload.style === "selection") {
          void Haptics.selectionAsync();
        } else {
          const feedback = {
            success: Haptics.NotificationFeedbackType.Success,
            warning: Haptics.NotificationFeedbackType.Warning,
            error: Haptics.NotificationFeedbackType.Error,
          }[message.payload.style];
          void Haptics.notificationAsync(feedback);
        }
        break;
      case "OPEN_EXTERNAL_URL":
        if (!isTrustedScholarUrl(message.payload.url)) openExternalUrl(message.payload.url);
        break;
      case "SHARE_CONTENT":
        void Share.share({
          title: message.payload.title,
          message: [message.payload.text, message.payload.url].filter(Boolean).join("\n"),
          url: Platform.OS === "ios" ? message.payload.url : undefined,
        });
        break;
    }
  }, [insets.bottom, sendToWeb]);

  const handleHttpError = useCallback((event: HttpErrorEvent) => {
    const { statusCode, url } = event.nativeEvent;
    if (statusCode >= 500 && url === mainUrlRef.current) setIsOffline(true);
  }, []);

  const retry = useCallback(() => {
    setIsOffline(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ uri: SCHOLAR_WEB_URL }}
          style={styles.webView}
          containerStyle={styles.webViewContainer}
          originWhitelist={["https://scholar-v1.vercel.app", "about:blank"]}
          injectedJavaScriptBeforeContentLoaded={bootstrapScript}
          injectedJavaScript={SCHOLAR_BRIDGE_SCRIPT}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigation}
          onShouldStartLoadWithRequest={handleShouldStart}
          onOpenWindow={handleOpenWindow}
          onLoadStart={() => {
            setIsOffline(false);
            setIsLoading(true);
          }}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => setIsOffline(true)}
          onHttpError={handleHttpError}
          onRenderProcessGone={() => setIsOffline(true)}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={false}
          domStorageEnabled
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          javaScriptEnabled
          scalesPageToFit={false}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          mixedContentMode="never"
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          webviewDebuggingEnabled={__DEV__}
          applicationNameForUserAgent="ScholarAndroid/1.0"
          androidLayerType="hardware"
          pullToRefreshEnabled
          allowsBackForwardNavigationGestures={false}
          overScrollMode="never"
          scrollEnabled
        />
        {isLoading && !isOffline ? <ScholarWebLoading /> : null}
        {isOffline ? <ScholarOfflineScreen onRetry={retry} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#050506", flex: 1 },
  container: { backgroundColor: "#050506", flex: 1 },
  webViewContainer: { backgroundColor: "#050506" },
  webView: { backgroundColor: "#050506", flex: 1 },
});
