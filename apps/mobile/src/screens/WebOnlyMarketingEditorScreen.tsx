import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { getWebsiteBaseUrl } from "../lib/store-api";
import { theme } from "../theme/theme";

const DEFAULT_WEBSITE = "https://greencoatvets.com";

/** Marketing editors manage the public website — not the clinic mobile app. */
export function WebOnlyMarketingEditorScreen({ onSignOut }: { onSignOut: () => void }) {
  const websiteUrl = getWebsiteBaseUrl() ?? DEFAULT_WEBSITE;

  return (
    <View style={styles.wrap}>
      <MaterialIcons name="language" size={56} color={theme.primary} />
      <Text style={styles.title}>Use the website admin</Text>
      <Text style={styles.body}>
        Website editor accounts work in the marketing admin on the web (blog, pages, branding). The mobile app is for clinic
        operations only.
      </Text>
      <Pressable style={styles.linkBtn} onPress={() => Linking.openURL(`${websiteUrl}/admin`)}>
        <Text style={styles.linkBtnText}>Open website admin</Text>
      </Pressable>
      <Pressable style={styles.outline} onPress={onSignOut}>
        <Text style={styles.outlineText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
    backgroundColor: "transparent",
    gap: 14,
  },
  title: { fontSize: 20, fontWeight: "800", color: theme.onSurface, textAlign: "center" },
  body: { fontSize: 15, color: theme.onSurfaceVariant, textAlign: "center", lineHeight: 22 },
  linkBtn: {
    marginTop: 8,
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  linkBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
  outline: { paddingVertical: 12 },
  outlineText: { color: theme.primary, fontWeight: "700", fontSize: 15 },
});
