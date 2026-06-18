import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

export type BookingDoctor = { id: string; full_name: string; branch_id: string | null };

type Slot = { starts_at: string; ends_at: string; label: string };

type Props = {
  clinicId: string;
  branchId: string;
  doctors: BookingDoctor[];
  optionalDoctor?: boolean;
  doctorId: string;
  onDoctorIdChange: (id: string) => void;
  startsAt: string;
  onStartsAtChange: (iso: string) => void;
};

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingDoctorSlotPicker({
  clinicId,
  branchId,
  doctors,
  optionalDoctor = false,
  doctorId,
  onDoctorIdChange,
  startsAt,
  onStartsAtChange,
}: Props) {
  const [slotDate, setSlotDate] = useState(() => toDateInputValue(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredDoctors = useMemo(
    () => doctors.filter((d) => !branchId || !d.branch_id || d.branch_id === branchId),
    [doctors, branchId],
  );

  const loadSlots = useCallback(async () => {
    if (!doctorId || !slotDate || !clinicId) {
      setSlots([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_public_booking_slots", {
        p_clinic_id: clinicId,
        p_branch_id: branchId || null,
        p_doctor_id: doctorId,
        p_date: slotDate,
      });
      if (rpcError) throw new Error(rpcError.message);
      const list = Array.isArray(data) ? (data as Slot[]) : [];
      setSlots(list);
      if (!list.some((s) => s.starts_at === startsAt)) {
        onStartsAtChange("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load slots");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, branchId, doctorId, slotDate, startsAt, onStartsAtChange]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    if (!doctorId) {
      setSlots([]);
      onStartsAtChange("");
    }
  }, [doctorId, onStartsAtChange]);

  const minDate = toDateInputValue(new Date());

  const dateOptions = useMemo(() => {
    const out: string[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 21; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      out.push(toDateInputValue(d));
    }
    return out;
  }, []);

  return (
    <View style={{ marginTop: 4 }}>
      <Text style={[commonStyles.muted, { marginBottom: 12 }]}>
        Choose a doctor and an available time slot. Slots reflect clinic schedules and existing bookings.
      </Text>

      <Text style={commonStyles.sectionLabel}>Doctor</Text>
      <View style={styles.chipRow}>
        {optionalDoctor ? (
          <Pressable
            style={[styles.chip, !doctorId && styles.chipActive]}
            onPress={() => onDoctorIdChange("")}
          >
            <Text style={[styles.chipText, !doctorId && styles.chipTextActive]}>Any clinician</Text>
          </Pressable>
        ) : null}
        {filteredDoctors.map((d) => (
          <Pressable
            key={d.id}
            style={[styles.chip, doctorId === d.id && styles.chipActive]}
            onPress={() => onDoctorIdChange(d.id)}
          >
            <Text style={[styles.chipText, doctorId === d.id && styles.chipTextActive]} numberOfLines={1}>
              {d.full_name}
            </Text>
          </Pressable>
        ))}
      </View>

      {doctorId ? (
        <>
          <Text style={[commonStyles.sectionLabel, { marginTop: 14 }]}>Date</Text>
          <View style={styles.chipRow}>
            {dateOptions.map((d) => {
              const label = new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const disabled = d < minDate;
              return (
                <Pressable
                  key={d}
                  style={[styles.chip, slotDate === d && styles.chipActive, disabled && { opacity: 0.35 }]}
                  disabled={disabled}
                  onPress={() => {
                    setSlotDate(d);
                    onStartsAtChange("");
                  }}
                >
                  <Text style={[styles.chipText, slotDate === d && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[commonStyles.sectionLabel, { marginTop: 14 }]}>Time slot</Text>
          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 12 }} />
          ) : error ? (
            <Text style={{ color: theme.error, marginVertical: 8 }}>{error}</Text>
          ) : slots.length === 0 ? (
            <Text style={commonStyles.muted}>No open slots this day. Try another date or doctor.</Text>
          ) : (
            <View style={styles.chipRow}>
              {slots.map((slot) => (
                <Pressable
                  key={slot.starts_at}
                  style={[styles.chip, startsAt === slot.starts_at && styles.chipActive]}
                  onPress={() => onStartsAtChange(slot.starts_at)}
                >
                  <Text style={[styles.chipText, startsAt === slot.starts_at && styles.chipTextActive]}>{slot.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.surfaceContainer,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    maxWidth: "100%",
  },
  chipActive: {
    backgroundColor: `${theme.primary}22`,
    borderColor: theme.primary,
  },
  chipText: { color: theme.onSurface, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: theme.primary, fontWeight: "800" },
});
