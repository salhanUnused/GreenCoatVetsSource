import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
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
  onWalkIn: (input: {
    ownerName: string;
    phone: string;
    email: string;
    petName: string;
    species: string;
    branchId: string;
  }) => Promise<void>;
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
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("canine");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");

  useEffect(() => {
    if (!branchId && branches[0]?.id) setBranchId(branches[0].id);
  }, [branches, branchId]);

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
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>
          Walk-ins, check-ins, and today&apos;s in-clinic queue. Use the Walk-in QR tab for guest self-booking.
        </Text>
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
          <Text style={[commonStyles.muted, { marginBottom: 10 }]}>
            Pet owners asked to move these appointments — approve to apply the new time.
          </Text>
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

      <Modal visible={walkOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Walk-in guest</Text>
            <Text style={[commonStyles.muted, { marginBottom: 12 }]}>Minimal fields — full profile can be completed later.</Text>
            <Text style={commonStyles.sectionLabel}>Owner</Text>
            <TextInput style={commonStyles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Full name" placeholderTextColor={theme.outline} />
            <Text style={[commonStyles.sectionLabel, { marginTop: 10 }]}>Phone</Text>
            <TextInput style={commonStyles.input} value={phone} onChangeText={setPhone} placeholder="+91…" keyboardType="phone-pad" placeholderTextColor={theme.outline} />
            <Text style={[commonStyles.sectionLabel, { marginTop: 10 }]}>Email</Text>
            <TextInput
              style={commonStyles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="owner@email.com (for prescriptions & reports)"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={theme.outline}
            />
            <Text style={[commonStyles.sectionLabel, { marginTop: 10 }]}>Pet</Text>
            <TextInput style={commonStyles.input} value={petName} onChangeText={setPetName} placeholder="Pet name" placeholderTextColor={theme.outline} />
            <Text style={[commonStyles.sectionLabel, { marginTop: 10 }]}>Species</Text>
            <TextInput style={commonStyles.input} value={species} onChangeText={setSpecies} placeholder="canine, feline…" placeholderTextColor={theme.outline} />
            <Text style={[commonStyles.sectionLabel, { marginTop: 10 }]}>Branch</Text>
            <View style={styles.branchRow}>
              {branches.map((b) => (
                <Pressable key={b.id} style={[styles.chip, branchId === b.id && styles.chipOn]} onPress={() => setBranchId(b.id)}>
                  <Text style={[styles.chipText, branchId === b.id && styles.chipTextOn]}>{b.name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={commonStyles.btnOutline} onPress={() => setWalkOpen(false)}>
                <Text style={commonStyles.btnOutlineText}>Close</Text>
              </Pressable>
              <Pressable
                style={commonStyles.btnPrimary}
                onPress={() =>
                  void onWalkIn({
                    ownerName: ownerName.trim(),
                    phone: phone.trim(),
                    email: email.trim(),
                    petName: petName.trim(),
                    species: species.trim() || "unknown",
                    branchId: branchId || branches[0]?.id || "",
                  }).then(() => {
                    setWalkOpen(false);
                    setOwnerName("");
                    setPhone("");
                    setEmail("");
                    setPetName("");
                    setSpecies("canine");
                  })
                }
              >
                <Text style={commonStyles.btnPrimaryText}>Create visit</Text>
              </Pressable>
            </View>
          </View>
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
  modalBackdrop: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end", padding: 16 },
  modalCard: { backgroundColor: theme.surfaceContainerHigh, borderRadius: 18, padding: 18, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: theme.onSurface, marginBottom: 4 },
  branchRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.outlineVariant },
  chipOn: { borderColor: theme.primary, backgroundColor: `${theme.primary}14` },
  chipText: { fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: theme.primary, fontWeight: "800" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
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
