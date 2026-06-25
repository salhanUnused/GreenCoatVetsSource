import { useMemo, useState } from "react";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AppointmentStatusPicker } from "../components/AppointmentStatusPicker";
import { DoctorStackParamList } from "../navigation/types";
import { Appointment, DoctorNotification } from "../types/app";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";
import { PetAvatar } from "../components/PetAvatar";

type FilterKey = "all" | "upcoming" | "ongoing" | "completed" | "emergency";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function formatQueueDate(d: Date) {
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  if (target.getTime() === today.getTime()) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target.getTime() === tomorrow.getTime()) return "Tomorrow";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (target.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function DoctorQueueScreen({
  appointments,
  queueDate,
  onQueueDateChange,
  onStatusChange,
  onUploadDocument,
  onGeneratePdf,
  notifications,
  refreshing,
  onRefresh,
}: {
  appointments: Appointment[];
  queueDate: Date;
  onQueueDateChange: (date: Date) => void;
  onStatusChange: (appointmentId: string, status: string) => Promise<void>;
  onUploadDocument: (appointmentId: string) => Promise<void>;
  onGeneratePdf?: (appointmentId: string) => Promise<void>;
  notifications: DoctorNotification[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<DoctorStackParamList>>();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [statusPickerFor, setStatusPickerFor] = useState<Appointment | null>(null);
  const [pdfBusyFor, setPdfBusyFor] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      const isEmergency = (a.appointment_type ?? "").toLowerCase() === "emergency";
      if (filter === "ongoing" && a.status !== "checked_in") return false;
      if (filter === "emergency") return isEmergency;
      if (filter === "completed") return a.status === "completed";
      if (filter === "upcoming" && a.status !== "scheduled") return false;
      if (!q) return true;
      const petName = (a.pets?.name ?? "").toLowerCase();
      const ownerName = (a.owners?.full_name ?? "").toLowerCase();
      const ownerPhone = (a.owners?.phone ?? "").toLowerCase();
      return petName.includes(q) || ownerName.includes(q) || ownerPhone.includes(q);
    });
  }, [appointments, filter, query]);

  const emergencyCount = appointments.filter((a) => (a.appointment_type ?? "").toLowerCase() === "emergency").length;
  const nextUp = filtered.find((a) => a.status !== "completed" && a.status !== "cancelled" && a.status !== "no_show");

  function shiftDate(days: number) {
    const d = new Date(queueDate);
    d.setDate(d.getDate() + days);
    onQueueDateChange(startOfDay(d));
  }

  async function openConsult(appointmentId: string) {
    navigation.navigate("Consult", { appointmentId });
  }

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={[commonStyles.scrollContent, styles.pagePad]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <View style={styles.dateRow}>
        <Pressable style={styles.dateNavBtn} onPress={() => shiftDate(-1)} accessibilityLabel="Previous day">
          <MaterialIcons name="chevron-left" size={24} color={theme.primary} />
        </Pressable>
        <Pressable style={styles.dateCenter} onPress={() => onQueueDateChange(startOfDay(new Date()))}>
          <Text style={styles.dateLabel}>{formatQueueDate(queueDate)}</Text>
          <Text style={commonStyles.muted}>{queueDate.toLocaleDateString()}</Text>
        </Pressable>
        <Pressable style={styles.dateNavBtn} onPress={() => shiftDate(1)} accessibilityLabel="Next day">
          <MaterialIcons name="chevron-right" size={24} color={theme.primary} />
        </Pressable>
      </View>
      {!isSameDay(queueDate, new Date()) ? (
        <Pressable style={styles.todayBtn} onPress={() => onQueueDateChange(startOfDay(new Date()))}>
          <Text style={styles.todayBtnText}>Jump to today</Text>
        </Pressable>
      ) : null}

      {nextUp ? (
        <LinearGradient colors={[theme.primaryContainer, theme.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroOverline}>Next up</Text>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroPet}>{nextUp.pets?.name ?? "Pet"}</Text>
              <Text style={styles.heroMeta}>
                {nextUp.pets?.breed ?? nextUp.pets?.species ?? "Pet"} · {new Date(nextUp.starts_at).toLocaleTimeString()}
              </Text>
              <Text style={styles.heroOwner}>{nextUp.owners?.full_name ?? "Owner"}</Text>
            </View>
            <Pressable style={styles.heroBtn} onPress={() => void openConsult(nextUp.id)}>
              <MaterialIcons name="play-circle" size={18} color={theme.primary} />
              <Text style={styles.heroBtnText}>Open</Text>
            </Pressable>
          </View>
        </LinearGradient>
      ) : null}

      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Appointments</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>
          Tap a row to open the visit. Change status or upload lab reports and documents.
        </Text>
        <TextInput
          style={[commonStyles.input, styles.searchInput]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search pet name or owner phone"
          placeholderTextColor={theme.outline}
        />

        <View style={styles.chips}>
          {(
            [
              ["all", "All"],
              ["upcoming", "Upcoming"],
              ["ongoing", "Ongoing"],
              ["completed", "Completed"],
              ["emergency", "Emergency"],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} style={[styles.chip, filter === key && styles.chipOn]} onPress={() => setFilter(key)}>
              <Text style={[styles.chipText, filter === key && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.metaRow}>
          <Text style={commonStyles.muted}>{appointments.length} on this day</Text>
          <Text style={commonStyles.muted}>Emergency: {emergencyCount} · Alerts: {notifications.length}</Text>
        </View>

        <View style={styles.queueWrap}>
          {filtered.map((appointment, index) => (
            <View style={[styles.queueItem, index === 0 && styles.queueItemFirst]} key={appointment.id}>
              <Pressable onPress={() => void openConsult(appointment.id)}>
                <View style={styles.queueHeader}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeHour}>
                      {new Date(appointment.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <PetAvatar uri={appointment.pets?.photo_url} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timeText}>{appointment.pets?.name ?? "Pet"}</Text>
                    <Text style={commonStyles.muted}>
                      {appointment.owners?.full_name ?? "Owner"} · {appointment.branches?.name ?? "Branch"}
                      {!appointment.doctor_id ? " · Unassigned" : ""}
                    </Text>
                    <View style={[styles.statusChip, chipForStatus(appointment.status)]}>
                      <Text style={styles.statusChipText}>
                        {(appointment.appointment_type ?? "").toLowerCase() === "emergency" ? "Emergency · " : ""}
                        {appointment.status.replaceAll("_", " ")}
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={theme.outline} />
                </View>
              </Pressable>
              <View style={commonStyles.actionRow}>
                {appointment.status === "scheduled" ? (
                  <Pressable style={commonStyles.btnOutline} onPress={() => void onStatusChange(appointment.id, "checked_in")}>
                    <Text style={commonStyles.btnOutlineText}>Check-in</Text>
                  </Pressable>
                ) : null}
                <Pressable style={commonStyles.btnPrimary} onPress={() => void openConsult(appointment.id)}>
                  <Text style={commonStyles.btnPrimaryText}>Open visit</Text>
                </Pressable>
                <Pressable style={commonStyles.btnOutline} onPress={() => setStatusPickerFor(appointment)}>
                  <Text style={commonStyles.btnOutlineText}>Status</Text>
                </Pressable>
                <Pressable style={commonStyles.btnOutline} onPress={() => void onUploadDocument(appointment.id)}>
                  <Text style={commonStyles.btnOutlineText}>Upload</Text>
                </Pressable>
                {onGeneratePdf ? (
                  <Pressable
                    style={[commonStyles.btnOutline, pdfBusyFor === appointment.id && { opacity: 0.5 }]}
                    disabled={pdfBusyFor === appointment.id}
                    onPress={async () => {
                      setPdfBusyFor(appointment.id);
                      try {
                        await onGeneratePdf(appointment.id);
                      } finally {
                        setPdfBusyFor(null);
                      }
                    }}
                  >
                    <Text style={commonStyles.btnOutlineText}>{pdfBusyFor === appointment.id ? "PDF…" : "PDF"}</Text>
                  </Pressable>
                ) : null}
                {appointment.status !== "cancelled" && appointment.status !== "completed" ? (
                  <>
                    <Pressable style={commonStyles.btnOutline} onPress={() => void onStatusChange(appointment.id, "cancelled")}>
                      <Text style={commonStyles.btnOutlineText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={commonStyles.btnOutline} onPress={() => void onStatusChange(appointment.id, "no_show")}>
                      <Text style={commonStyles.btnOutlineText}>No-show</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>
          ))}
        </View>
        {!filtered.length ? <Text style={commonStyles.emptyState}>No appointments for this filter.</Text> : null}
      </View>

      <AppointmentStatusPicker
        visible={!!statusPickerFor}
        currentStatus={statusPickerFor?.status ?? "scheduled"}
        onClose={() => setStatusPickerFor(null)}
        onSelect={(status) => {
          if (!statusPickerFor) return;
          void onStatusChange(statusPickerFor.id, status);
        }}
      />
    </ScrollView>
  );
}

function chipForStatus(status: string) {
  const s = status.toLowerCase();
  if (s === "completed") return { backgroundColor: `${theme.outlineVariant}66`, borderColor: `${theme.outline}44` };
  if (s === "checked_in") return { backgroundColor: `${theme.primaryFixedDim}55`, borderColor: `${theme.primary}44` };
  if (s === "scheduled") return { backgroundColor: `${theme.secondaryContainer}66`, borderColor: `${theme.secondary}44` };
  if (s === "cancelled" || s === "no_show") return { backgroundColor: `${theme.errorContainer}88`, borderColor: `${theme.error}44` };
  return { backgroundColor: `${theme.primaryContainer}66`, borderColor: `${theme.tertiary}44` };
}

const styles = StyleSheet.create({
  pagePad: { paddingTop: 8, paddingBottom: 44 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  dateNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceBright,
  },
  dateCenter: { flex: 1, alignItems: "center", paddingVertical: 6 },
  dateLabel: { fontSize: 18, fontWeight: "900", color: theme.onSurface },
  todayBtn: { alignSelf: "center", marginBottom: 8, paddingHorizontal: 12, paddingVertical: 6 },
  todayBtnText: { color: theme.primary, fontWeight: "800", fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceContainer,
  },
  chipOn: {
    borderColor: theme.primary,
    backgroundColor: `${theme.primary}18`,
  },
  chipText: { fontWeight: "700", fontSize: 12, color: theme.onSurface },
  chipTextOn: { color: theme.primary },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  hero: { borderRadius: 26, padding: 18, marginTop: 4, marginBottom: 10 },
  heroOverline: { color: "#ffffffcc", fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", fontSize: 11, marginBottom: 6 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroPet: { color: "#fff", fontSize: 28, fontWeight: "900", lineHeight: 30 },
  heroMeta: { color: "#ffffffcc", fontWeight: "700", marginTop: 2 },
  heroOwner: { color: "#fff", marginTop: 8, fontWeight: "700" },
  heroBtn: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 6 },
  heroBtnText: { color: theme.primary, fontWeight: "800" },
  glassCard: {
    backgroundColor: `${theme.surfaceContainerLow}dd`,
    borderColor: `${theme.outlineVariant}77`,
  },
  searchInput: { marginBottom: 2 },
  queueWrap: { gap: 10, marginTop: 2 },
  queueItem: {
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}66`,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    backgroundColor: theme.surfaceContainerLow,
  },
  queueItemFirst: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  timeBox: { backgroundColor: theme.surfaceContainerHighest, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: theme.outlineVariant },
  timeHour: { fontWeight: "900", color: theme.primary, fontSize: 12 },
  timeText: { fontWeight: "800", color: theme.onSurface, fontSize: 15 },
  statusChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase", color: theme.onSurfaceVariant },
});
