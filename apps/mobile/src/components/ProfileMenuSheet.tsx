import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { AppBranding } from "../lib/app-branding";
import { theme, shadows } from "../theme/theme";

export function ProfileMenuSheet({
  visible,
  topInset,
  branding,
  roleLabel,
  clinicMeta,
  userEmail,
  onClose,
  onSignOut,
}: {
  visible: boolean;
  topInset: number;
  branding: AppBranding | null;
  roleLabel: string;
  clinicMeta: string;
  userEmail?: string | null;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      backdrop.setValue(0);
      sheet.setValue(0);
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(sheet, {
          toValue: 1,
          damping: 16,
          stiffness: 220,
          mass: 0.85,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdrop, sheet]);

  function closeWithAnimation(cb?: () => void) {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheet, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      cb?.();
    });
  }

  const translateY = sheet.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] });
  const scale = sheet.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const opacity = sheet.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeWithAnimation()}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeWithAnimation()} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              top: topInset + 52,
              opacity,
              transform: [{ translateY }, { scale }],
            },
          ]}
        >
          <LinearGradient
            colors={[`${theme.primary}22`, "rgba(255,255,255,0.98)", `${theme.primaryContainer}18`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetBg}
          >
            <LinearGradient colors={[theme.primary, theme.primaryContainer]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accent} />

            <View style={styles.avatarWrap}>
              <LinearGradient colors={[`${theme.primary}33`, `${theme.primaryContainer}55`]} style={styles.avatarRing}>
                {branding?.logo_url ? (
                  <Image source={{ uri: branding.logo_url }} style={styles.avatarLogo} resizeMode="contain" />
                ) : (
                  <MaterialIcons name="person" size={28} color={theme.primary} />
                )}
              </LinearGradient>
            </View>

            <Text style={styles.brand}>{branding?.product_name ?? "GreenCoatVets"}</Text>
            {userEmail ? (
              <Text style={styles.email} numberOfLines={1}>
                {userEmail}
              </Text>
            ) : null}

            <View style={styles.roleCard}>
              <Text style={styles.roleKicker}>Signed in as</Text>
              <Text style={styles.role}>{roleLabel.replace(/_/g, " ")}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {clinicMeta}
              </Text>
            </View>

            <Pressable
              style={styles.signOut}
              onPress={() => closeWithAnimation(onSignOut)}
            >
              <LinearGradient colors={["#36c497", theme.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.signOutGrad}>
                <MaterialIcons name="logout" size={20} color="#fff" />
                <Text style={styles.signOutText}>Sign out</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.closeBtn} onPress={() => closeWithAnimation()}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 20, 16, 0.52)",
  },
  sheet: {
    position: "absolute",
    right: 14,
    width: 300,
    borderRadius: 22,
    overflow: "hidden",
    ...shadows.card,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 16,
  },
  sheetBg: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 0,
    borderWidth: 1,
    borderColor: `${theme.primary}33`,
    borderRadius: 22,
  },
  accent: {
    height: 4,
    marginHorizontal: -18,
    marginBottom: 16,
  },
  avatarWrap: { alignItems: "center", marginBottom: 10 },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: `${theme.primary}44`,
  },
  avatarLogo: { width: 40, height: 40, borderRadius: 10 },
  brand: { fontSize: 20, fontWeight: "800", color: theme.onSurface, textAlign: "center", letterSpacing: -0.3 },
  email: { marginTop: 4, fontSize: 12, color: theme.onSurfaceVariant, textAlign: "center", fontWeight: "600" },
  roleCard: {
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    backgroundColor: `${theme.primary}0c`,
    borderWidth: 1,
    borderColor: `${theme.primary}22`,
  },
  roleKicker: { fontSize: 10, fontWeight: "800", color: theme.outline, textTransform: "uppercase", letterSpacing: 1.1 },
  role: { marginTop: 4, fontSize: 18, fontWeight: "800", color: theme.primary, textTransform: "capitalize" },
  meta: { marginTop: 6, fontSize: 12, color: theme.onSurfaceVariant, fontWeight: "600" },
  signOut: { marginTop: 16, borderRadius: 14, overflow: "hidden" },
  signOutGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  signOutText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  closeBtn: { marginTop: 10, paddingVertical: 8, alignItems: "center" },
  closeText: { color: theme.onSurfaceVariant, fontWeight: "700", fontSize: 14 },
});
