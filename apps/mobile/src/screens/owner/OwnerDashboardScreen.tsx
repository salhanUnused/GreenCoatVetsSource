import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { summarizePrescriptionForDashboard } from "../../lib/formatPrescription";
import { commonStyles } from "../../theme/commonStyles";
import { theme } from "../../theme/theme";
import { Appointment, OwnerPrescription, OwnerVisitReport, Pet } from "../../types/app";
import { OwnerNeonCard } from "../../components/OwnerNeonCard";
import { PetAvatar } from "../../components/PetAvatar";

type Vac = {
  id: string;
  vaccine_name: string;
  due_on: string | null;
  status: string | null;
  pets?: { name?: string | null } | null;
};
type Attachment = {
  id: string;
  file_name: string | null;
  created_at: string;
  visit_id: string | null;
};

export function OwnerDashboardScreen({
  pets,
  appointments,
  vaccinations,
  prescriptions,
  attachments,
  visitReports,
  refreshing,
  onRefresh,
  onGoBook,
  onGoPets,
  onGoHealth,
}: {
  pets: Pet[];
  appointments: Appointment[];
  vaccinations: Vac[];
  prescriptions: OwnerPrescription[];
  attachments: Attachment[];
  visitReports: OwnerVisitReport[];
  refreshing: boolean;
  onRefresh: () => void;
  onGoBook: () => void;
  onGoPets: () => void;
  onGoHealth: () => void;
}) {
  const now = Date.now();
  /** Allow small clock skew; treat as "future" from this point. */
  const CLOCK_SLACK_MS = 5 * 60 * 1000;
  /** If nothing is in the future, still show a recent scheduled visit (same-day / forgot check-in). */
  const RECENT_SCHEDULED_MS = 72 * 60 * 60 * 1000;

  function terminalStatus(s: string | undefined) {
    const x = (s ?? "").toLowerCase();
    return x === "cancelled" || x === "completed" || x === "no_show";
  }
  function startsAtMs(iso: string) {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : NaN;
  }

  const active = appointments.filter((a) => {
    if (terminalStatus(a.status)) return false;
    return Number.isFinite(startsAtMs(a.starts_at));
  });

  /** Prefer earliest future (or in-progress); avoids hiding visits that just started but are still "scheduled". */
  const futureOrdered = active
    .filter((a) => {
      const t = startsAtMs(a.starts_at);
      const st = (a.status ?? "").toLowerCase();
      if (st === "checked_in") return true;
      return t >= now - CLOCK_SLACK_MS;
    })
    .sort((a, b) => startsAtMs(a.starts_at) - startsAtMs(b.starts_at));

  const recentScheduledPast = active
    .filter((a) => {
      const st = (a.status ?? "").toLowerCase();
      const t = startsAtMs(a.starts_at);
      return st === "scheduled" && t < now - CLOCK_SLACK_MS && t >= now - RECENT_SCHEDULED_MS;
    })
    .sort((a, b) => startsAtMs(b.starts_at) - startsAtMs(a.starts_at));

  const nextAppt = futureOrdered[0] ?? recentScheduledPast[0];
  const nextApptIsPast = nextAppt ? startsAtMs(nextAppt.starts_at) < now - CLOCK_SLACK_MS : false;

  function dueOnMs(due: string | null) {
    if (!due) return NaN;
    const s = due.includes("T") ? due : `${due}T12:00:00`;
    return new Date(s).getTime();
  }
  const dueSoon = vaccinations.filter((v) => {
    if (!v.due_on) return false;
    const t = dueOnMs(v.due_on);
    if (!Number.isFinite(t)) return false;
    return t <= now + 30 * 86400000;
  });
  const recentRx = prescriptions.slice(0, 3);
  const recentFiles = attachments.slice(0, 3);

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={[commonStyles.scrollContent, { paddingTop: 4 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <Text style={styles.headline}>Your dashboard</Text>
      <Text style={styles.sub}>Convenience and tracking for your pets.</Text>

      <View style={styles.quickRow}>
        <Pressable style={styles.quickTile} onPress={onGoBook}>
          <MaterialIcons name="event" size={28} color={theme.primary} />
          <Text style={styles.quickLabel}>Book</Text>
        </Pressable>
        <Pressable style={styles.quickTile} onPress={onGoPets}>
          <MaterialIcons name="pets" size={28} color={theme.primary} />
          <Text style={styles.quickLabel}>Pets</Text>
        </Pressable>
        <Pressable style={styles.quickTile} onPress={onGoHealth}>
          <MaterialIcons name="folder-open" size={28} color={theme.primary} />
          <Text style={styles.quickLabel}>Records</Text>
        </Pressable>
      </View>

      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Upcoming appointment</Text>
        {nextAppt ? (
          <View style={styles.row}>
            <PetAvatar uri={nextAppt.pets?.photo_url} size={42} />
            <View style={{ flex: 1 }}>
              {nextApptIsPast ? (
                <Text style={styles.pastHint}>Recent slot — still scheduled (confirm time in Book tab)</Text>
              ) : null}
              <Text style={styles.em}>{new Date(nextAppt.starts_at).toLocaleString()}</Text>
              <Text style={commonStyles.muted}>
                {nextAppt.pets?.name ?? "Pet"} · {nextAppt.branches?.name ?? "Branch"}
              </Text>
              <View style={commonStyles.pill}>
                <Text style={commonStyles.pillText}>{nextAppt.status}</Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={commonStyles.emptyState}>No upcoming visits. Book one from the Book tab.</Text>
        )}
      </OwnerNeonCard>

      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Vaccination alerts</Text>
        {dueSoon.length ? (
          dueSoon.map((v) => (
            <Text key={v.id} style={styles.alertLine}>
              {v.pets?.name ? `${v.pets.name}: ` : ""}
              {v.vaccine_name} — due {v.due_on ?? "—"}
            </Text>
          ))
        ) : (
          <Text style={commonStyles.emptyState}>No vaccines due in the next 30 days.</Text>
        )}
      </OwnerNeonCard>

      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Recent prescriptions</Text>
        {recentRx.length ? (
          recentRx.map((r) => (
            <Text key={r.id} style={styles.rxLine}>
              {new Date(r.issued_at).toLocaleDateString()} — {r.notes ?? "Prescription"}
            </Text>
          ))
        ) : (
          <Text style={commonStyles.emptyState}>No prescriptions yet.</Text>
        )}
      </OwnerNeonCard>

      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Medical files</Text>
        {recentFiles.length ? (
          recentFiles.map((f) => (
            <Pressable key={f.id} onPress={onGoHealth} style={{ marginBottom: 6 }}>
              <Text style={styles.fileLine}>
                {new Date(f.created_at).toLocaleDateString()} — {f.file_name ?? "Medical file"}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={commonStyles.emptyState}>No medical files yet.</Text>
        )}
      </OwnerNeonCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headline: { fontSize: 22, fontWeight: "800", color: theme.onSurface },
  sub: { color: theme.onSurfaceVariant, marginBottom: 16, fontSize: 14 },
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  quickTile: {
    flex: 1,
    backgroundColor: theme.surfaceContainerLow,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: `${theme.primary}44`,
    gap: 6,
    shadowColor: theme.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  quickLabel: { fontWeight: "800", fontSize: 12, color: theme.primary },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  pastHint: { fontSize: 12, fontWeight: "600", color: theme.tertiary, marginBottom: 4 },
  em: { fontWeight: "700", color: theme.onSurface, fontSize: 15 },
  alertLine: { color: theme.onSurfaceVariant, marginBottom: 6, fontSize: 14 },
  rxLine: { color: theme.onSurfaceVariant, marginBottom: 6, fontSize: 14 },
  fileTitle: { fontWeight: "700", color: theme.onSurface, fontSize: 14 },
  fileLine: { color: theme.onSurfaceVariant, fontSize: 13, marginTop: 2 },
});
