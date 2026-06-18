import { useCallback, useMemo } from "react";
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AppAmbientBackground } from "../components/AppAmbientBackground";
import { getWebsiteBaseUrl } from "../lib/store-api";
import { theme, shadows } from "../theme/theme";

const DEFAULT_WEBSITE = "https://greencoatvets.com";

export function InviteQrMobileScreen({ clinicId }: { clinicId: string; membershipRole?: string }) {
  const walkInUrl = useMemo(() => {
    const base = getWebsiteBaseUrl() ?? DEFAULT_WEBSITE;
    return `${base}/book?walk_in=1`;
  }, []);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(walkInUrl)}`;
  const clinicIdDisplay = clinicId.replace(/-/g, "").slice(0, 8).toUpperCase();

  const shareLink = useCallback(async () => {
    try {
      await Share.share({ message: walkInUrl, url: walkInUrl, title: "Walk-in booking" });
    } catch {
      /* cancelled */
    }
  }, [walkInUrl]);

  return (
    <View style={styles.root}>
      <AppAmbientBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <LinearGradient colors={[`${theme.primary}18`, `${theme.primaryContainer}30`]} style={styles.heroIcon}>
            <MaterialIcons name="qr-code-2" size={28} color={theme.primary} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>WALK-IN</Text>
            <Text style={styles.heroTitle}>Guest check-in QR</Text>
            <Text style={styles.heroSub}>
              Same QR as reception on the web — pet owners scan to book a walk-in visit without an account.
            </Text>
          </View>
        </View>

        <View style={styles.qrWrap}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerBR} />
          <LinearGradient colors={["#36c497", theme.primary]} style={styles.qrGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.qrInner}>
              <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
              <View style={styles.encryptedPill}>
                <View style={styles.pulseDot} />
                <Text style={styles.encryptedText}>WALK-IN BOOKING</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.linkCard}>
          <Text style={styles.linkLabel}>Booking link</Text>
          <Text selectable style={styles.linkMono}>
            {walkInUrl}
          </Text>
        </View>

        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Clinic ID</Text>
            <Text style={styles.metaVal}>{clinicIdDisplay}</Text>
          </View>
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => Linking.openURL(qrUrl)}>
          <LinearGradient colors={["#36c497", theme.primary]} style={styles.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <MaterialIcons name="download" size={22} color="#fff" />
            <Text style={styles.primaryBtnText}>Open QR image</Text>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => void shareLink()}>
          <MaterialIcons name="share" size={22} color={theme.onSecondaryContainer} />
          <Text style={styles.secondaryBtnText}>Share walk-in link</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  hero: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  heroKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: theme.onSurfaceVariant },
  heroTitle: { fontSize: 22, fontWeight: "800", color: theme.onSurface, letterSpacing: -0.3 },
  heroSub: { marginTop: 4, fontSize: 13, color: theme.onSurfaceVariant, lineHeight: 18 },
  qrWrap: { alignItems: "center", marginBottom: 20 },
  cornerTL: {
    position: "absolute",
    left: -4,
    top: -4,
    width: 44,
    height: 44,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: `${theme.primaryContainer}55`,
    borderTopLeftRadius: 14,
    zIndex: 0,
  },
  cornerBR: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 44,
    height: 44,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: `${theme.primaryContainer}55`,
    borderBottomRightRadius: 14,
    zIndex: 0,
  },
  qrGradient: {
    padding: 3,
    borderRadius: 22,
    width: "100%",
    maxWidth: 300,
    alignSelf: "center",
    ...shadows.card,
  },
  qrInner: {
    borderRadius: 20,
    backgroundColor: "#fff",
    padding: 16,
    alignItems: "center",
  },
  qrImage: { width: 260, height: 260 },
  encryptedPill: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${theme.primaryContainer}18`,
  },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primaryContainer },
  encryptedText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, color: theme.primary },
  linkCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}66`,
    backgroundColor: "#ffffff",
    padding: 16,
    marginBottom: 16,
  },
  linkLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: theme.onSurfaceVariant, marginBottom: 6 },
  linkMono: { fontSize: 11, color: theme.onSurface, fontFamily: "Menlo" },
  metaCard: {
    borderRadius: 16,
    backgroundColor: theme.surfaceContainerLow,
    padding: 16,
    marginBottom: 16,
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaKey: { fontSize: 14, fontWeight: "500", color: theme.onSurfaceVariant },
  metaVal: { fontSize: 16, fontWeight: "800", color: theme.onSurface },
  primaryBtn: { borderRadius: 14, overflow: "hidden", marginBottom: 10 },
  primaryGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: theme.secondaryContainer,
    marginBottom: 24,
  },
  secondaryBtnText: { color: theme.onSecondaryContainer, fontSize: 16, fontWeight: "800" },
});
