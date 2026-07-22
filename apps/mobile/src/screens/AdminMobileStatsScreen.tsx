import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminMobileStats } from "../types/app";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

export function AdminMobileStatsScreen({
  title,
  subtitle: _subtitle,
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
        <View style={styles.grid}>
          <StatTile icon="event" label="Appointments today" value={stats ? String(stats.appointmentsToday) : "—"} />
          <StatTile icon="schedule" label="Time change requests" value={stats ? String(stats.pendingTimeChanges) : "—"} />
          <StatTile icon="inventory" label="Low stock SKUs" value={stats ? String(stats.lowStockSkus) : "—"} />
        </View>
      </View>
    </ScrollView>
  );
}

function StatTile({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <MaterialIcons name={icon} size={22} color={theme.primary} />
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
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
});
