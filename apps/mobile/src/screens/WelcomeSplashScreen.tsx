import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { AppAmbientBackground } from "../components/AppAmbientBackground";
import { PawCircularLoader } from "../components/PawCircularLoader";
import { loadAppBranding, type AppBranding } from "../lib/app-branding";
import { theme, shadows } from "../theme/theme";

const MIN_SPLASH_MS = 2400;

type Props = {
  /** True when auth/session bootstrap is finished. */
  ready: boolean;
  onFinish: () => void;
};

/**
 * Animated welcome splash shown on every cold start — bridges native splash → app UI.
 */
export function WelcomeSplashScreen({ ready, onFinish }: Props) {
  const [branding, setBranding] = useState<AppBranding | null>(null);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const finishedRef = useRef(false);

  const logoScale = useRef(new Animated.Value(0.55)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(22)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    loadAppBranding().then((b) => {
      if (!cancelled) setBranding(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 72,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleY, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(loaderOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [loaderOpacity, logoOpacity, logoScale, subtitleOpacity, titleOpacity, titleY]);

  useEffect(() => {
    if (!ready || !minTimeElapsed || finishedRef.current) return;
    finishedRef.current = true;
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 380,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [minTimeElapsed, onFinish, ready, screenOpacity]);

  const productName = branding?.product_name ?? "GreenCoatVets";

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <AppAmbientBackground />
      <LinearGradient
        colors={[`${theme.primary}18`, "transparent", `${theme.primaryContainer}22`]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.content}>
        <Text style={styles.kicker}>WELCOME TO</Text>

        <Animated.View
          style={[
            styles.logoWrap,
            shadows.logo,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          {branding?.logo_url ? (
            <Image source={{ uri: branding.logo_url }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.logoFallback}>
              <MaterialIcons name="pets" size={52} color={theme.primary} />
            </View>
          )}
        </Animated.View>

        <Animated.Text
          style={[
            styles.title,
            { opacity: titleOpacity, transform: [{ translateY: titleY }] },
          ]}
        >
          {productName}
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          Caring for pets, connected to your clinic.
        </Animated.Text>

        <Animated.View style={[styles.loaderWrap, { opacity: loaderOpacity }]}>
          <PawCircularLoader size={72} message={ready ? "Almost there…" : "Loading…"} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: theme.onSurfaceVariant,
    marginBottom: 20,
  },
  logoWrap: {
    width: 108,
    height: 108,
    borderRadius: 28,
    backgroundColor: theme.surfaceBright,
    borderWidth: 1,
    borderColor: `${theme.primary}22`,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: 76,
    height: 76,
  },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 22,
    fontSize: 36,
    fontWeight: "900",
    color: theme.primary,
    letterSpacing: -0.8,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: theme.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 300,
  },
  loaderWrap: {
    marginTop: 36,
  },
});
