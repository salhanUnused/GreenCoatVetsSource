import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { buildDoctorVideoJoinUrl } from "../../lib/online-consult";
import { supabase } from "../../lib/supabase";
import { commonStyles } from "../../theme/commonStyles";
import { theme } from "../../theme/theme";

export type OnlineConsultCallRow = {
  id: string;
  starts_at: string;
  status: string;
  owner_name: string;
  owner_email: string | null;
  pet_name: string;
  doctor_token: string | null;
  paid_live: boolean;
};

function terminalStatus(status: string) {
  const s = status.toLowerCase();
  return s === "completed" || s === "cancelled" || s === "no_show";
}

export function SeniorVideoCallsScreen({
  clinicId,
  refreshing,
  onRefresh,
}: {
  clinicId: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [rows, setRows] = useState<OnlineConsultCallRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const slack = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, starts_at, status, online_consult_paid_at, online_consult_doctor_join_token, razorpay_payment_id, owners(full_name, email), pets(name)",
      )
      .eq("clinic_id", clinicId)
      .eq("appointment_type", "online_consult")
      .not("online_consult_paid_at", "is", null)
      .gte("starts_at", slack.toISOString())
      .order("starts_at", { ascending: true })
      .limit(80);

    if (error) {
      console.warn("online consult calls", error.message);
      setRows([]);
    } else {
      const mapped = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
        const ownerRaw = row.owners as { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
        const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;
        const petRaw = row.pets as { name?: string | null } | Array<{ name?: string | null }> | null;
        const pet = Array.isArray(petRaw) ? petRaw[0] : petRaw;
        const paymentId = (row.razorpay_payment_id as string | null) ?? null;
        return {
          id: row.id as string,
          starts_at: row.starts_at as string,
          status: row.status as string,
          owner_name: owner?.full_name?.trim() || "Pet owner",
          owner_email: owner?.email?.trim() || null,
          pet_name: pet?.name?.trim() || "Pet",
          doctor_token: (row.online_consult_doctor_join_token as string | null) ?? null,
          paid_live: Boolean(paymentId && !paymentId.startsWith("test_")),
        };
      });
      setRows(mapped.filter((r) => !terminalStatus(r.status)));
    }
    setLoading(false);
  }, [clinicId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = useMemo(() => rows.filter((r) => new Date(r.starts_at).getTime() >= Date.now() - 30 * 60 * 1000), [rows]);

  async function handleRefresh() {
    await load();
    onRefresh();
  }

  function openJoin(row: OnlineConsultCallRow) {
    if (!row.doctor_token) {
      return;
    }
    const url = buildDoctorVideoJoinUrl(row.id, row.doctor_token);
    void Linking.openURL(url);
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
        <Text style={commonStyles.cardTitle}>Video consultations</Text>
        <Text style={[commonStyles.muted, { marginBottom: 14 }]}>
          Upcoming Senior Vet online calls booked by pet owners. Tap join to open the video room in your browser.
        </Text>
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginVertical: 16 }} />
        ) : upcoming.length ? (
          upcoming.map((row, i) => {
            const canJoin = Boolean(row.doctor_token);
            const isSoon = new Date(row.starts_at).getTime() - Date.now() < 15 * 60 * 1000;
            return (
              <View key={row.id} style={[styles.row, i === upcoming.length - 1 && styles.rowLast]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.petName}>{row.pet_name}</Text>
                  <Text style={commonStyles.muted}>{row.owner_name}</Text>
                  {row.owner_email ? <Text style={styles.email}>{row.owner_email}</Text> : null}
                  <Text style={styles.when}>{new Date(row.starts_at).toLocaleString()}</Text>
                  <View style={styles.metaRow}>
                    <View style={commonStyles.pill}>
                      <Text style={commonStyles.pillText}>{row.status.replace(/_/g, " ")}</Text>
                    </View>
                    <View style={[styles.payPill, row.paid_live ? styles.payLive : styles.payTest]}>
                      <Text style={[styles.payText, row.paid_live ? styles.payTextLive : styles.payTextTest]}>
                        {row.paid_live ? "Paid" : "Test"}
                      </Text>
                    </View>
                    {isSoon ? (
                      <View style={styles.soonPill}>
                        <Text style={styles.soonText}>Starting soon</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                {canJoin ? (
                  <Pressable onPress={() => openJoin(row)} style={styles.joinWrap}>
                    <LinearGradient colors={["#36c497", theme.primary]} style={styles.joinBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <MaterialIcons name="videocam" size={22} color="#fff" />
                      <Text style={styles.joinText}>Join</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Text style={styles.pending}>Link pending</Text>
                )}
              </View>
            );
          })
        ) : (
          <Text style={commonStyles.emptyState}>No upcoming video calls scheduled.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  rowLast: { borderBottomWidth: 0 },
  petName: { fontSize: 16, fontWeight: "800", color: theme.onSurface },
  email: { fontSize: 12, color: theme.onSurfaceVariant, marginTop: 2 },
  when: { marginTop: 6, fontSize: 14, fontWeight: "700", color: theme.primary },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" },
  payPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  payLive: { backgroundColor: `${theme.primary}18` },
  payTest: { backgroundColor: `${theme.tertiary}22` },
  payText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  payTextLive: { color: theme.primary },
  payTextTest: { color: theme.tertiary },
  soonPill: { backgroundColor: `${theme.error}14`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  soonText: { fontSize: 10, fontWeight: "800", color: theme.error },
  joinWrap: { borderRadius: 12, overflow: "hidden" },
  joinBtn: { alignItems: "center", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 4, minWidth: 72 },
  joinText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  pending: { fontSize: 12, color: theme.outline, fontStyle: "italic", paddingTop: 8 },
});
