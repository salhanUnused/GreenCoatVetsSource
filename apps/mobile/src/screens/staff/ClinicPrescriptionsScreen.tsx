import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { commonStyles } from "../../theme/commonStyles";
import { theme } from "../../theme/theme";

export function ClinicPrescriptionsScreen({
  prescriptions,
  onOpenPrescriptionPdf,
  refreshing,
  onRefresh,
}: {
  prescriptions: Array<{
    id: string;
    issued_at: string;
    notes: string | null;
    pdf_url: string | null;
    pets?: { name?: string | null } | null;
  }>;
  onOpenPrescriptionPdf: (prescriptionId: string) => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
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
        <Text style={commonStyles.cardTitle}>Prescriptions</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>Recent clinic prescriptions — tap to open PDF when available.</Text>
        {prescriptions.length ? (
          prescriptions.map((p, i) => (
            <Pressable
              key={p.id}
              style={[styles.row, i === prescriptions.length - 1 && styles.rowLast]}
              onPress={() => void onOpenPrescriptionPdf(p.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{p.pets?.name ?? "Pet"}</Text>
                <Text style={commonStyles.muted}>
                  {new Date(p.issued_at).toLocaleString()} · {p.notes ? `${p.notes.slice(0, 48)}…` : "Prescription"}
                </Text>
              </View>
              <MaterialIcons name="picture-as-pdf" size={22} color={theme.primary} />
            </Pressable>
          ))
        ) : (
          <Text style={commonStyles.emptyState}>No prescriptions yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  rowLast: { borderBottomWidth: 0 },
  title: { fontWeight: "800", color: theme.onSurface, fontSize: 15 },
});
