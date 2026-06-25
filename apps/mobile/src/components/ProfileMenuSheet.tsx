import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
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
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { top: topInset + 52 }]}>
          <View style={styles.accent} />

          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              {branding?.logo_url ? (
                <Image source={{ uri: branding.logo_url }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <MaterialIcons name="person" size={28} color={theme.primary} />
              )}
            </View>
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

          <Pressable style={styles.signOut} onPress={onSignOut}>
            <MaterialIcons name="logout" size={20} color={theme.onPrimary} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 20, 16, 0.45)",
  },
  sheet: {
    position: "absolute",
    right: 14,
    width: 300,
    borderRadius: 16,
    backgroundColor: theme.surfaceBright,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    overflow: "hidden",
    ...shadows.card,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  accent: {
    height: 4,
    marginHorizontal: -18,
    marginBottom: 16,
    backgroundColor: theme.primary,
  },
  avatarWrap: { alignItems: "center", marginBottom: 10 },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceContainer,
    borderWidth: 2,
    borderColor: theme.primary,
    overflow: "hidden",
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  brand: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.onSurface,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  email: {
    marginTop: 4,
    fontSize: 12,
    color: theme.onSurfaceVariant,
    textAlign: "center",
    fontWeight: "600",
  },
  roleCard: {
    marginTop: 14,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.surfaceContainer,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
  },
  roleKicker: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.outline,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  role: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "800",
    color: theme.primary,
    textTransform: "capitalize",
  },
  meta: {
    marginTop: 6,
    fontSize: 12,
    color: theme.onSurfaceVariant,
    fontWeight: "600",
  },
  signOut: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: theme.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  signOutText: { color: theme.onPrimary, fontWeight: "800", fontSize: 15 },
  closeBtn: { marginTop: 10, paddingVertical: 8, alignItems: "center" },
  closeText: { color: theme.onSurfaceVariant, fontWeight: "700", fontSize: 14 },
});
