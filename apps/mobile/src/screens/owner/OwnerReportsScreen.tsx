import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { OwnerNeonCard } from "../../components/OwnerNeonCard";
import { commonStyles } from "../../theme/commonStyles";
import { theme } from "../../theme/theme";
import type { OwnerVisitSummaryRow } from "../../types/app";

export function OwnerReportsScreen({
  reportsEnabled,
  visitSummaries,
  onOpenVisitReport,
  onDownloadAll,
  downloadingAll,
  refreshing,
  onRefresh,
}: {
  reportsEnabled: boolean;
  visitSummaries: OwnerVisitSummaryRow[];
  onOpenVisitReport: (visitId: string) => Promise<void>;
  onDownloadAll: () => Promise<void>;
  downloadingAll: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const readyReports = visitSummaries.filter((v) => v.report_ready);

  function formatWhen(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return "—";
    }
  }

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Visit reports</Text>

        {reportsEnabled && readyReports.length > 1 ? (
          <Pressable
            style={[styles.downloadAllBtn, downloadingAll && { opacity: 0.6 }]}
            disabled={downloadingAll}
            onPress={() => void onDownloadAll()}
          >
            <MaterialIcons name="file-download" size={20} color={theme.onPrimary} />
            <Text style={styles.downloadAllText}>{downloadingAll ? "Preparing PDFs…" : `Download all (${readyReports.length})`}</Text>
          </Pressable>
        ) : null}
      </OwnerNeonCard>

      <OwnerNeonCard>
        {visitSummaries.length ? (
          visitSummaries.map((v, i) => (
            <View key={v.id} style={[styles.row, i === visitSummaries.length - 1 && styles.rowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.petName}>{v.pet_name}</Text>
                <Text style={commonStyles.muted}>{v.branch_name}</Text>
                <Text style={styles.when}>{formatWhen(v.visited_at)}</Text>
                <Text style={styles.status}>{v.status_label}</Text>
              </View>
              {reportsEnabled ? (
                v.report_ready ? (
                  <Pressable style={styles.pdfBtn} onPress={() => void onOpenVisitReport(v.id)}>
                    <MaterialIcons name="picture-as-pdf" size={22} color={theme.primary} />
                    <Text style={styles.pdfBtnText}>Open PDF</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.pending}>PDF pending</Text>
                )
              ) : null}
            </View>
          ))
        ) : (
          <Text style={commonStyles.emptyState}>No completed visits on file yet.</Text>
        )}
      </OwnerNeonCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  downloadAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  downloadAllText: { color: theme.onPrimary, fontWeight: "800", fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  rowLast: { borderBottomWidth: 0 },
  petName: { fontWeight: "800", fontSize: 16, color: theme.onSurface },
  when: { marginTop: 4, fontSize: 13, fontWeight: "600", color: theme.onSurface },
  status: { marginTop: 2, fontSize: 12, color: theme.primary, fontWeight: "700" },
  pdfBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: `${theme.primary}10`,
    minWidth: 76,
  },
  pdfBtnText: { marginTop: 4, fontSize: 11, fontWeight: "800", color: theme.primary },
  pending: { fontSize: 11, color: theme.outline, fontWeight: "600", maxWidth: 80, textAlign: "right" },
});
