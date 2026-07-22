import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { commonStyles } from "../../theme/commonStyles";
import { theme } from "../../theme/theme";

export function ClinicPrescriptionsScreen({
  prescriptions,
  onOpenPrescriptionPdf,
  onGeneratePrescriptionPdf,
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
  onGeneratePrescriptionPdf?: (prescriptionId: string) => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

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
        {prescriptions.length ? (
          prescriptions.map((p, i) => {
            const hasPdf = Boolean(p.pdf_url?.trim());
            return (
              <View key={p.id} style={[styles.row, i === prescriptions.length - 1 && styles.rowLast]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{p.pets?.name ?? "Pet"}</Text>
                  <Text style={commonStyles.muted}>
                    {new Date(p.issued_at).toLocaleString()}
                    {p.notes ? ` · ${p.notes.slice(0, 40)}${p.notes.length > 40 ? "…" : ""}` : ""}
                  </Text>
                </View>
                {hasPdf ? (
                  <Pressable style={styles.pdfBtn} onPress={() => void onOpenPrescriptionPdf(p.id)}>
                    <MaterialIcons name="picture-as-pdf" size={22} color={theme.primary} />
                    <Text style={styles.pdfLabel}>Open</Text>
                  </Pressable>
                ) : onGeneratePrescriptionPdf ? (
                  <Pressable
                    style={[styles.pdfBtn, busyId === p.id && { opacity: 0.5 }]}
                    disabled={busyId === p.id}
                    onPress={async () => {
                      setBusyId(p.id);
                      try {
                        await onGeneratePrescriptionPdf(p.id);
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    <MaterialIcons name="picture-as-pdf" size={22} color={theme.primary} />
                    <Text style={styles.pdfLabel}>{busyId === p.id ? "…" : "Generate"}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.pending}>No PDF</Text>
                )}
              </View>
            );
          })
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
  pdfBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: `${theme.primary}10`,
    minWidth: 72,
  },
  pdfLabel: { marginTop: 2, fontSize: 11, fontWeight: "800", color: theme.primary },
  pending: { fontSize: 11, color: theme.outline, fontWeight: "600" },
});
