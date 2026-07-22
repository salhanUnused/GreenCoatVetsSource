import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const productName = branding?.product_name ?? "GreenCoatVets";
  const role = formatRole(roleLabel || "guest");
  const sheetWidth = Math.min(300, Math.max(240, windowWidth - 28));
  const sheetTop = Math.max(insets.top, topInset, 12) + 52;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={styles.root} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss profile menu" />

        <View
          style={[styles.sheet, { top: sheetTop, width: sheetWidth, right: 14 }]}
          pointerEvents="box-none"
        >
          <View style={styles.header}>
            <View style={styles.avatarCircle}>
              <MaterialIcons name="person" size={28} color={theme.primary} />
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
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <MaterialIcons name="close" size={22} color={theme.onSurfaceVariant} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <MaterialIcons name="badge" size={18} color={theme.primary} />
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{role}</Text>
            </View>
          </View>

          <Pressable
            style={styles.signOut}
            onPress={() => {
              onClose();
              onSignOut();
            }}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <MaterialIcons name="logout" size={20} color={theme.onPrimary} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 20, 0.42)",
  },
  sheet: {
    position: "absolute",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    ...shadows.card,
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
    zIndex: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceContainer,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  headerText: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.onSurface,
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
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.surfaceContainer,
    marginBottom: 14,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
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
});
