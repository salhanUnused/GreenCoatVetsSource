import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { WalkInScreen, type WalkInInput } from "../WalkInScreen";
import { Appointment, StaffDoctorOption } from "../../types/app";
import { commonStyles } from "../../theme/commonStyles";
import { theme } from "../../theme/theme";
import { PetAvatar } from "../../components/PetAvatar";

/** Reception desk: walk-ins, today's queue, doctor assignment, check-in — no billing or shop. */
export function ReceptionQueueScreen({
  appointments,
  doctors,
  branches,
  onStatusChange,
  onUploadDocument,
  onOpenPrescriptionForAppointment,
  onAssignDoctor,
  onWalkIn,
  refreshing,
  onRefresh,
  pendingTimeChangeRequests = [],
  onApproveTimeChangeRequest,
}: {
  appointments: Appointment[];
  doctors: StaffDoctorOption[];
  branches: Array<{ id: string; name: string }>;
  onStatusChange: (appointmentId: string, status: string) => Promise<void>;
  onUploadDocument: (appointmentId: string) => Promise<void>;
  onOpenPrescriptionForAppointment: (appointmentId: string) => Promise<void>;
  onAssignDoctor: (appointmentId: string, doctorStaffId: string | null) => Promise<void>;
  onWalkIn: (input: WalkInInput) => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
  pendingTimeChangeRequests?: Array<{
    id: string;
    appointment_id: string;
    requested_starts_at: string;
    current_starts_at?: string | null;
    pet_name?: string | null;
  }>;
  onApproveTimeChangeRequest?: (requestId: string) => Promise<void>;
}) {
  const [walkOpen, setWalkOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.min(windowHeight * 0.92, windowHeight - Math.max(insets.top, 12));

  const inPersonToday = appointments.filter((a) => (a.appointment_type ?? "") !== "online_consult");

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Reception</Text>
        <View style={styles.heroRow}>
          <Pressable style={styles.heroBtn} onPress={() => setWalkOpen(true)}>
            <MaterialIcons name="person-add-alt-1" size={28} color={theme.onPrimary} />
            <Text style={styles.heroBtnText}>Walk-in guest</Text>
          </Pressable>
        </View>
      </View>

      {pendingTimeChangeRequests.length ? (
        <View style={[commonStyles.card, { borderColor: `${theme.primary}44`, borderWidth: 1 }]}>
          <Text style={commonStyles.cardTitle}>Time change requests</Text>
          {pendingTimeChangeRequests.map((req) => (
            <View key={req.id} style={styles.requestRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestPet}>{req.pet_name ?? "Pet"}</Text>
                <Text style={commonStyles.muted}>
                  Was: {req.current_starts_at ? new Date(req.current_starts_at).toLocaleString() : "—"}
                </Text>
                <Text style={styles.requestNew}>Requested: {new Date(req.requested_starts_at).toLocaleString()}</Text>
              </View>
              {onApproveTimeChangeRequest ? (
                <Pressable style={styles.approveBtn} onPress={() => void onApproveTimeChangeRequest(req.id)}>
                  <Text style={styles.approveBtnText}>Approve</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Today&apos;s in-clinic queue</Text>
        {inPersonToday.map((appointment, index) => (
          <View style={[styles.queueItem, index === 0 && styles.queueItemFirst]} key={appointment.id}>
            <View style={styles.queueHeader}>
              <PetAvatar uri={appointment.pets?.photo_url} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.timeText}>{new Date(appointment.starts_at).toLocaleString()}</Text>
                <Text style={commonStyles.muted}>
                  {appointment.pets?.name ?? "Pet"} · {appointment.owners?.full_name ?? "Owner"} ·{" "}
                  {appointment.branches?.name ?? "Branch"}
                </Text>
              </View>
              <View style={commonStyles.pill}>
                <Text style={commonStyles.pillText}>{appointment.status}</Text>
              </View>
            </View>
            <Text style={[commonStyles.sectionLabel, { marginTop: 10 }]}>Assign doctor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.docRow}>
              <Pressable
                style={[styles.docChip, !appointment.doctor_id && styles.docChipOn]}
                onPress={() => void onAssignDoctor(appointment.id, null)}
              >
                <Text style={[styles.docChipText, !appointment.doctor_id && styles.docChipTextOn]}>Unassigned</Text>
              </Pressable>
              {doctors.map((d) => (
                <Pressable
                  key={d.id}
                  style={[styles.docChip, appointment.doctor_id === d.id && styles.docChipOn]}
                  onPress={() => void onAssignDoctor(appointment.id, d.id)}
                >
                  <Text style={[styles.docChipText, appointment.doctor_id === d.id && styles.docChipTextOn]}>{d.full_name}</Text>
                </Pressable>
              ))}
            </ScrollView>
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
              <Pressable style={commonStyles.btnOutline} onPress={() => onOpenPrescriptionForAppointment(appointment.id)}>
                <Text style={commonStyles.btnOutlineText}>Rx PDF</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {!inPersonToday.length ? <Text style={commonStyles.emptyState}>No in-clinic appointments for today.</Text> : null}
      </View>

      <Modal visible={walkOpen} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setWalkOpen(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.modalCard, { height: sheetHeight, paddingBottom: Math.max(insets.bottom, 10) }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Walk-in guest</Text>
              <Pressable onPress={() => setWalkOpen(false)} hitSlop={12} accessibilityLabel="Close walk-in form">
                <MaterialIcons name="close" size={24} color={theme.onSurfaceVariant} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <WalkInScreen
                embedded
                branches={branches}
                onWalkIn={async (input) => {
                  await onWalkIn(input);
                  setWalkOpen(false);
                }}
                refreshing={false}
                onRefresh={() => undefined}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: "row", gap: 10 },
  heroBtn: {
    flex: 1,
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 6,
  },
  heroBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 14 },
  queueItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.outlineVariant,
    paddingTop: 14,
    marginTop: 14,
  },
  queueItemFirst: { borderTopWidth: 0, marginTop: 0, paddingTop: 0 },
  queueHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  timeText: { fontWeight: "800", color: theme.onSurface, fontSize: 14 },
  docRow: { flexDirection: "row", gap: 8, paddingVertical: 6 },
  docChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceContainer,
  },
  docChipOn: { borderColor: theme.primary, backgroundColor: `${theme.primary}18` },
  docChipText: { fontSize: 12, fontWeight: "600", color: theme.onSurface },
  docChipTextOn: { color: theme.primary, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    width: "100%",
    backgroundColor: theme.surfaceBright,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: theme.onSurface },
  modalBody: {
    flex: 1,
    minHeight: 0,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  requestPet: { fontWeight: "800", color: theme.onSurface, fontSize: 15 },
  requestNew: { fontWeight: "600", color: theme.primary, marginTop: 4, fontSize: 13 },
  approveBtn: { backgroundColor: theme.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  approveBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 13 },
});
