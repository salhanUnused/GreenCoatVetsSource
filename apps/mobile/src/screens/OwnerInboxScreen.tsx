import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { OwnerNeonCard } from "../components/OwnerNeonCard";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  channel: string;
  created_at: string;
  read_at: string | null;
  payload?: { kind?: string; visit_id?: string } | null;
};

function isVisitReportShared(item: NotificationItem) {
  const payload = item.payload;
  return payload?.kind === "visit_report_shared" && Boolean(payload.visit_id);
}

export function OwnerInboxScreen({
  notifications,
  refreshing,
  onRefresh,
  onOpenVisitReport,
}: {
  notifications: NotificationItem[];
  refreshing: boolean;
  onRefresh: () => void;
  onOpenVisitReport?: (visitId: string) => Promise<void>;
}) {
  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Inbox</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>
          Clinic updates, visit report alerts, and reminders.
        </Text>
        {notifications.map((item, index) => {
          const reportShared = isVisitReportShared(item);
          const visitId = item.payload?.visit_id;
          return (
            <Pressable
              key={item.id}
              style={[styles.notif, index === notifications.length - 1 && styles.notifLast, reportShared && styles.notifHighlight]}
              disabled={!reportShared || !visitId || !onOpenVisitReport}
              onPress={() => {
                if (reportShared && visitId && onOpenVisitReport) {
                  void onOpenVisitReport(visitId);
                }
              }}
            >
              <View style={styles.notifHeader}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <View style={[styles.channelPill, reportShared && styles.channelPillReport]}>
                  <Text style={[styles.channelText, reportShared && styles.channelTextReport]}>
                    {reportShared ? "Report" : item.channel}
                  </Text>
                </View>
              </View>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
              {reportShared && onOpenVisitReport ? (
                <View style={styles.openRow}>
                  <MaterialIcons name="picture-as-pdf" size={18} color={theme.primary} />
                  <Text style={styles.openLink}>Open visit report PDF</Text>
                </View>
              ) : null}
              {!item.read_at ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>New</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {!notifications.length ? <Text style={commonStyles.emptyState}>You’re all caught up.</Text> : null}
      </OwnerNeonCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  notif: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  notifHighlight: {
    backgroundColor: `${theme.primary}08`,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  notifLast: {
    borderBottomWidth: 0,
  },
  notifHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  notifTitle: { fontWeight: "800", color: theme.onSurface, fontSize: 16, flex: 1 },
  channelPill: {
    backgroundColor: theme.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
  },
  channelPillReport: {
    backgroundColor: `${theme.primary}18`,
    borderColor: theme.primary,
  },
  channelText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.outline,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  channelTextReport: { color: theme.primary },
  message: { color: theme.onSurfaceVariant, marginTop: 6, fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12, color: theme.outline, marginTop: 8, fontWeight: "500" },
  openRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  openLink: { color: theme.primary, fontWeight: "800", fontSize: 13 },
  unreadBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: `${theme.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unreadText: { color: theme.primary, fontWeight: "800", fontSize: 11 },
});
