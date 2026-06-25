import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AppointmentMonthCalendar, localDayKey } from "../../components/AppointmentMonthCalendar";
import { AppointmentStatusPicker } from "../../components/AppointmentStatusPicker";
import { normalizeAppointment } from "../../lib/normalizeAppointment";
import { supabase } from "../../lib/supabase";
import { Appointment } from "../../types/app";
import { commonStyles } from "../../theme/commonStyles";
import { theme } from "../../theme/theme";
import { PetAvatar } from "../../components/PetAvatar";

const APPOINTMENT_SELECT =
  "id, status, starts_at, appointment_type, branch_id, pet_id, owner_id, doctor_id, branches(name), owners(full_name, phone), pets(name, species, photo_url)";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function StaffAppointmentsCalendarScreen({
  clinicId,
  doctorStaffId,
  onStatusChange,
  onUploadDocument,
  onGeneratePdf,
  refreshing,
  onRefresh,
}: {
  clinicId: string;
  doctorStaffId?: string | null;
  onStatusChange: (appointmentId: string, status: string) => Promise<void>;
  onUploadDocument: (appointmentId: string) => Promise<void>;
  onGeneratePdf?: (appointmentId: string) => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [pdfBusyFor, setPdfBusyFor] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusPickerFor, setStatusPickerFor] = useState<Appointment | null>(null);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    const rangeStart = new Date(month.getFullYear(), month.getMonth(), 1);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    rangeEnd.setHours(23, 59, 59, 999);

    let query = supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("clinic_id", clinicId)
      .gte("starts_at", rangeStart.toISOString())
      .lte("starts_at", rangeEnd.toISOString())
      .order("starts_at", { ascending: true })
      .limit(500);

    if (doctorStaffId) {
      query = query.or(`doctor_id.eq.${doctorStaffId},doctor_id.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("calendar appointments", error.message);
      setAppointments([]);
    } else {
      setAppointments(((data as unknown[]) ?? []).map(normalizeAppointment));
    }
    setLoading(false);
  }, [clinicId, doctorStaffId, month]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const countsByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of appointments) {
      const key = localDayKey(new Date(a.starts_at));
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [appointments]);

  const dayAppointments = useMemo(
    () => appointments.filter((a) => sameDay(new Date(a.starts_at), selectedDay)),
    [appointments, selectedDay],
  );

  async function handleRefresh() {
    await loadMonth();
    onRefresh();
  }

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing || loading} onRefresh={() => void handleRefresh()} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Appointment calendar</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>Tap a day to see visits. Change status or attach files from the list.</Text>
        <AppointmentMonthCalendar
          month={month}
          onMonthChange={setMonth}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          countsByDay={countsByDay}
        />
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>
          {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </Text>
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginVertical: 16 }} />
        ) : dayAppointments.length ? (
          dayAppointments.map((a, i) => (
            <View key={a.id} style={[styles.row, i === dayAppointments.length - 1 && styles.rowLast]}>
              <PetAvatar uri={a.pets?.photo_url} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.petName}>{a.pets?.name ?? "Pet"}</Text>
                <Text style={commonStyles.muted}>{a.owners?.full_name ?? "Owner"}</Text>
                <Text style={styles.time}>
                  {new Date(a.starts_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  {a.branches?.name ? ` · ${a.branches.name}` : ""}
                </Text>
                <Pressable onPress={() => setStatusPickerFor(a)} style={styles.statusPill}>
                  <Text style={styles.statusText}>{a.status.replace(/_/g, " ")}</Text>
                  <MaterialIcons name="expand-more" size={16} color={theme.primary} />
                </Pressable>
              </View>
              <View style={styles.actionCol}>
                <Pressable style={styles.attachBtn} onPress={() => void onUploadDocument(a.id)}>
                  <MaterialIcons name="attach-file" size={22} color={theme.primary} />
                </Pressable>
                {onGeneratePdf ? (
                  <Pressable
                    style={[styles.attachBtn, pdfBusyFor === a.id && { opacity: 0.5 }]}
                    disabled={pdfBusyFor === a.id}
                    onPress={async () => {
                      setPdfBusyFor(a.id);
                      try {
                        await onGeneratePdf(a.id);
                      } finally {
                        setPdfBusyFor(null);
                      }
                    }}
                  >
                    <MaterialIcons name="picture-as-pdf" size={22} color={theme.primary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={commonStyles.emptyState}>No appointments this day.</Text>
        )}
      </View>

      {statusPickerFor ? (
        <AppointmentStatusPicker
          visible
          currentStatus={statusPickerFor.status}
          onClose={() => setStatusPickerFor(null)}
          onSelect={async (status: string) => {
            await onStatusChange(statusPickerFor.id, status);
            setStatusPickerFor(null);
            await loadMonth();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.outlineVariant,
  },
  rowLast: { borderBottomWidth: 0 },
  petName: { fontSize: 16, fontWeight: "800", color: theme.onSurface },
  time: { fontSize: 13, color: theme.onSurfaceVariant, marginTop: 2 },
  statusPill: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: `${theme.primary}14`,
  },
  statusText: { fontSize: 12, fontWeight: "700", color: theme.primary, textTransform: "capitalize" },
  actionCol: { marginLeft: 8, gap: 8 },
  attachBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: theme.surfaceContainerHigh,
  },
});
