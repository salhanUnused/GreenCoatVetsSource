import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { AppAmbientBackground } from "../components/AppAmbientBackground";
import { loadAppBranding, type AppBranding } from "../lib/app-branding";
import { theme } from "../theme/theme";

export function WelcomeScreen({
  consentAccepted,
  onAcceptConsent,
  onContinue,
}: {
  consentAccepted: boolean;
  onAcceptConsent: () => Promise<void> | void;
  onContinue: () => void;
}) {
  const [branding, setBranding] = useState<AppBranding | null>(null);
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAppBranding().then((b) => {
      if (!cancelled) setBranding(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.root}>
      <AppAmbientBackground />
      <View style={styles.content}>
        <Text style={styles.kicker}>WELCOME</Text>
        {branding?.logo_url ? (
          <Image source={{ uri: branding.logo_url }} style={styles.logo} resizeMode="contain" />
        ) : (
          <MaterialIcons name="pets" size={48} color={theme.primary} style={{ marginBottom: 8 }} />
        )}
        <Text style={styles.title}>{branding?.product_name ?? "GreenCoatVets"}</Text>
        <Text style={styles.subtitle}>Book visits, track care history, and stay connected with your clinic.</Text>

        <Pressable
          onPress={() => {
            if (!consentAccepted) {
              setShowConsent(true);
              return;
            }
            onContinue();
          }}
          style={styles.ctaWrap}
        >
          <LinearGradient colors={[theme.gradientStart, theme.gradientEnd]} style={styles.cta}>
            <Text style={styles.ctaText}>Continue</Text>
            <MaterialIcons name="arrow-forward" size={20} color={theme.onPrimary} />
          </LinearGradient>
        </Pressable>

        <Text style={styles.foot}>By continuing, you agree to safe use of your care data for clinic operations.</Text>
      </View>

      <Modal visible={showConsent} transparent animationType="fade" onRequestClose={() => setShowConsent(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setShowConsent(false)} />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Data sharing consent</Text>
            <Text style={styles.cardBody}>
              I agree that my profile, pet, appointment, and medical information can be shared with the clinic team for treatment,
              prescriptions, invoices, and follow-up communication.
            </Text>
            <View style={styles.actions}>
              <Pressable style={styles.btnGhost} onPress={() => setShowConsent(false)}>
                <Text style={styles.btnGhostText}>Not now</Text>
              </Pressable>
              <Pressable
                style={styles.btnPrimary}
                onPress={async () => {
                  await onAcceptConsent();
                  setShowConsent(false);
                  onContinue();
                }}
              >
                <Text style={styles.btnPrimaryText}>I agree</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: theme.onSurfaceVariant, textAlign: "center" },
  logo: { width: 72, height: 72, marginTop: 12, marginBottom: 4, alignSelf: "center" },
  title: { marginTop: 8, fontSize: 34, fontWeight: "900", color: theme.primary, letterSpacing: -0.6, textAlign: "center" },
  subtitle: { marginTop: 10, fontSize: 16, lineHeight: 24, color: theme.onSurfaceVariant, maxWidth: 340, textAlign: "center" },
  ctaWrap: { marginTop: 28, borderRadius: 8, overflow: "hidden", alignSelf: "stretch" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  ctaText: { fontSize: 16, fontWeight: "800", color: theme.onPrimary },
  foot: { marginTop: 14, fontSize: 12, color: theme.onSurfaceVariant, textAlign: "center" },
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 22 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,16,14,0.5)" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    padding: 18,
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: theme.onSurface },
  cardBody: { marginTop: 8, fontSize: 14, lineHeight: 21, color: theme.onSurfaceVariant },
  actions: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  btnGhost: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 6, borderWidth: 1, borderColor: theme.outlineVariant },
  btnGhostText: { fontWeight: "700", color: theme.onSurfaceVariant },
  btnPrimary: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 6, backgroundColor: theme.primary },
  btnPrimaryText: { fontWeight: "800", color: theme.onPrimary },
});
