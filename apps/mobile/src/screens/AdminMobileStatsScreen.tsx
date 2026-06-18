import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminMobileStats } from "../types/app";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

export function AdminMobileStatsScreen({
  title,
  subtitle,
  stats,
  refreshing,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  stats: AdminMobileStats | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>{title}</Text>
        <Text style={[commonStyles.muted, { marginBottom: 16 }]}>{subtitle}</Text>
        <View style={styles.grid}>
          <StatTile icon="event" label="Appointments today" value={stats ? String(stats.appointmentsToday) : "—"} hint="Across clinic" />
          <StatTile icon="schedule" label="Time change requests" value={stats ? String(stats.pendingTimeChanges) : "—"} hint="Awaiting approval" />
          <StatTile icon="inventory" label="Low stock SKUs" value={stats ? String(stats.lowStockSkus) : "—"} hint="Below reorder level" />
        </View>
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Alerts</Text>
        <AlertRow icon="warning-amber" text="Overbooking & schedule conflicts — review on web calendar." />
        <AlertRow icon="notifications-active" text="Configure push templates for low stock & no-shows." />
      </View>

      <View style={styles.footerNote}>
        <MaterialIcons name="smartphone" size={18} color={theme.outline} />
        <Text style={styles.footerText}>
          Use Patients, Calendar, and Reports tabs for day-to-day work. Staff roles and advanced analytics remain on the web dashboard.
        </Text>
      </View>
    </ScrollView>
  );
}

function StatTile({ icon, label, value, hint }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string; hint: string }) {
  return (
    <View style={styles.tile}>
      <MaterialIcons name={icon} size={22} color={theme.primary} />
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileHint}>{hint}</Text>
    </View>
  );
}

function AlertRow({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  return (
    <View style={styles.alertRow}>
      <MaterialIcons name={icon} size={20} color={theme.tertiary} />
      <Text style={styles.alertText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  tile: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.surfaceContainer,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    gap: 4,
  },
  tileValue: { fontSize: 22, fontWeight: "900", color: theme.onSurface },
  tileLabel: { fontWeight: "800", color: theme.onSurface, fontSize: 14 },
  tileHint: { fontSize: 12, color: theme.onSurfaceVariant },
  alertRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  alertText: { flex: 1, color: theme.onSurfaceVariant, fontSize: 14, lineHeight: 20 },
  footerNote: { flexDirection: "row", gap: 10, paddingHorizontal: 4, paddingBottom: 28 },
  footerText: { flex: 1, color: theme.outline, fontSize: 13, lineHeight: 18 },
});
