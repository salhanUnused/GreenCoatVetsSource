import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Appointment } from "../types/app";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

export function ReceptionistScreen({
  appointments,
  onStatusChange,
  onUploadDocument,
  onOpenPrescriptionForAppointment,
  refreshing,
  onRefresh,
  screenTitle = "Front desk",
  screenHint,
}: {
  appointments: Appointment[];
  onStatusChange: (appointmentId: string, status: string) => Promise<void>;
  onUploadDocument: (appointmentId: string) => Promise<void>;
  onOpenPrescriptionForAppointment?: (appointmentId: string) => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
  /** Tab title (e.g. Lab queue, Pharmacy today). */
  screenTitle?: string;
  screenHint?: string;
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
        <Text style={commonStyles.cardTitle}>{screenTitle}</Text>
        {appointments.map((appointment, index) => (
          <View style={[styles.queueItem, index === 0 && styles.queueItemFirst]} key={appointment.id}>
            <View style={styles.queueHeader}>
              <Text style={styles.timeText}>{new Date(appointment.starts_at).toLocaleString()}</Text>
              <View style={commonStyles.pill}>
                <Text style={commonStyles.pillText}>{appointment.status}</Text>
              </View>
            </View>
            <View style={commonStyles.actionRow}>
              <Pressable style={commonStyles.btnPrimary} onPress={() => onStatusChange(appointment.id, "checked_in")}>
                <Text style={commonStyles.btnPrimaryText}>Check-in</Text>
              </Pressable>
              <Pressable style={commonStyles.btnOutline} onPress={() => onStatusChange(appointment.id, "cancelled")}>
                <Text style={commonStyles.btnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={commonStyles.btnOutline} onPress={() => onStatusChange(appointment.id, "no_show")}>
                <Text style={commonStyles.btnOutlineText}>No-show</Text>
              </Pressable>
              <Pressable style={commonStyles.btnOutline} onPress={() => onUploadDocument(appointment.id)}>
                <Text style={commonStyles.btnOutlineText}>Upload</Text>
              </Pressable>
              {onOpenPrescriptionForAppointment ? (
                <Pressable style={commonStyles.btnOutline} onPress={() => onOpenPrescriptionForAppointment(appointment.id)}>
                  <Text style={commonStyles.btnOutlineText}>Rx PDF</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
        {!appointments.length ? <Text style={commonStyles.emptyState}>No appointments for this view.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  queueItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.outlineVariant,
    paddingTop: 14,
    marginTop: 14,
  },
  queueItemFirst: {
    borderTopWidth: 0,
    marginTop: 0,
    paddingTop: 0,
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  timeText: { fontWeight: "700", color: theme.onSurface, flex: 1, fontSize: 14 },
});
