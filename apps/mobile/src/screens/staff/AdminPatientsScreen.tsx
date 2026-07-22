import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { commonStyles } from "../../theme/commonStyles";
import { theme } from "../../theme/theme";

export type AdminPatientRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  pet_count: number;
};

export function AdminPatientsScreen({
  clinicId,
  refreshing,
  onRefresh,
}: {
  clinicId: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [rows, setRows] = useState<AdminPatientRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("owners")
      .select("id, full_name, phone, email, pets(id)")
      .eq("clinic_id", clinicId)
      .order("full_name", { ascending: true })
      .limit(200);
    if (error) {
      console.warn("admin patients", error.message);
      setRows([]);
    } else {
      const mapped = ((data ?? []) as Array<{
        id: string;
        full_name: string | null;
        phone: string | null;
        email: string | null;
        pets?: Array<{ id: string }> | null;
      }>).map((o) => ({
        id: o.id,
        full_name: o.full_name,
        phone: o.phone,
        email: o.email,
        pet_count: Array.isArray(o.pets) ? o.pets.length : 0,
      }));
      setRows(mapped);
    }
    setLoading(false);
  }, [clinicId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || loading}
          onRefresh={() => {
            void load();
            onRefresh();
          }}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Patients & clients</Text>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : rows.length ? (
          rows.map((r, i) => (
            <View key={r.id} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
              <View style={styles.avatar}>
                <MaterialIcons name="person" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.full_name?.trim() || "Unnamed owner"}</Text>
                <Text style={commonStyles.muted}>
                  {r.pet_count} pet{r.pet_count === 1 ? "" : "s"}
                  {r.phone && r.phone !== "NA" ? ` · ${r.phone}` : ""}
                </Text>
                {r.email ? <Text style={styles.email}>{r.email}</Text> : null}
              </View>
              {r.phone && r.phone !== "NA" ? (
                <Pressable style={styles.callBtn} onPress={() => void Linking.openURL(`tel:${r.phone}`)}>
                  <MaterialIcons name="phone" size={20} color={theme.primary} />
                </Pressable>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={commonStyles.emptyState}>No patients found.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.outlineVariant,
  },
  rowLast: { borderBottomWidth: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${theme.primary}14`,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 16, fontWeight: "800", color: theme.onSurface },
  email: { fontSize: 12, color: theme.onSurfaceVariant, marginTop: 2 },
  callBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: theme.surfaceContainerHigh,
  },
});
