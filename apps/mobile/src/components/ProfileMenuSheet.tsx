import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { AppBranding } from "../lib/app-branding";
import { theme, shadows } from "../theme/theme";

function formatRole(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProfileMenuSheet({
  visible,
  topInset,
  branding,
  roleLabel,
  userEmail,
  onClose,
  onSignOut,
}: {
  visible: boolean;
  topInset: number;
  branding: AppBranding | null;
  roleLabel: string;
  userEmail?: string | null;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const productName = branding?.product_name ?? "GreenCoatVets";
  const role = formatRole(roleLabel || "guest");

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss profile menu" />

        <View style={[styles.sheet, { top: topInset + 52 }]}>
          <View style={styles.header}>
            <View style={styles.avatarCircle}>
              <MaterialIcons name="person" size={30} color={theme.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={1}>
                {productName}
              </Text>
              {userEmail ? (
                <Text style={styles.email} numberOfLines={1}>
                  {userEmail}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Account</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <MaterialIcons name="badge" size={18} color={theme.primary} />
              </View>
              <View style={styles.infoBody}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={styles.infoValue}>{role}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <Pressable style={styles.signOut} onPress={onSignOut} accessibilityRole="button" accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={20} color={theme.onPrimary} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>

          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
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
    backgroundColor: "rgba(15, 23, 20, 0.4)",
  },
  sheet: {
    position: "absolute",
    right: 14,
    width: 292,
    borderRadius: 18,
    backgroundColor: theme.surfaceBright,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    ...shadows.card,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceContainer,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  headerText: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.onSurface,
    letterSpacing: -0.2,
  },
  email: {
    marginTop: 3,
    fontSize: 12,
    color: theme.onSurfaceVariant,
    fontWeight: "600",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.outlineVariant,
    marginVertical: 14,
  },
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.outline,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.surfaceContainer,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceBright,
  },
  infoBody: { flex: 1, minWidth: 0 },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.onSurfaceVariant,
  },
  infoValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: "800",
    color: theme.primary,
  },
  signOut: {
    borderRadius: 12,
    backgroundColor: theme.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  signOutText: { color: theme.onPrimary, fontWeight: "800", fontSize: 15 },
  closeBtn: { marginTop: 8, paddingVertical: 8, alignItems: "center" },
  closeText: { color: theme.onSurfaceVariant, fontWeight: "700", fontSize: 14 },
});
