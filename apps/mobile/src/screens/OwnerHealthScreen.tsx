import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatClinicDateTime, visitReportPdfSourceLabel } from "@saasclinics/lib";
import { formatPrescriptionItemLine } from "../lib/formatPrescription";
import { OwnerNeonCard } from "../components/OwnerNeonCard";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";
import type { OwnerPrescription, OwnerVisitReport } from "../types/app";

type Vaccination = {
  id: string;
  vaccine_name: string;
  due_on: string | null;
  status: string | null;
};

export function OwnerHealthScreen({
  prescriptions,
  vaccinations,
  attachments,
  visitReports,
  clinicTimezone,
  onOpenAttachment,
  onOpenPrescriptionPdf,
  onOpenVisitReport,
  onDownloadVisitReport,
  refreshing,
  onRefresh,
}: {
  prescriptions: OwnerPrescription[];
  vaccinations: Vaccination[];
  attachments: Array<{
    id: string;
    file_name: string | null;
    created_at: string;
    visit_id: string | null;
  }>;
  visitReports: OwnerVisitReport[];
  clinicTimezone?: string | null;
  onOpenAttachment: (attachmentId: string) => Promise<void>;
  onOpenPrescriptionPdf: (prescriptionId: string) => Promise<void>;
  onOpenVisitReport: (visitId: string) => Promise<void>;
  onDownloadVisitReport?: (visitId: string) => Promise<void>;
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
      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Prescriptions</Text>
        {prescriptions.map((prescription, i) => {
          const lines = prescription.prescription_items ?? [];
          const hasPdf = Boolean(prescription.pdf_url?.trim());
          return (
            <View
              style={[styles.rxBlock, i === prescriptions.length - 1 && styles.rxBlockLast]}
              key={prescription.id}
            >
              <View style={styles.rxHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>
                    {formatClinicDateTime(prescription.issued_at, clinicTimezone)}
                    {prescription.pets?.name ? ` · ${prescription.pets.name}` : ""}
                  </Text>
                  {prescription.notes?.trim() ? (
                    <Text style={[commonStyles.muted, { marginTop: 4 }]}>{prescription.notes.trim()}</Text>
                  ) : null}
                </View>
                <Pressable
                  style={[commonStyles.btnOutline, !hasPdf && styles.disabledBtn]}
                  disabled={!hasPdf}
                  onPress={() => onOpenPrescriptionPdf(prescription.id)}
                >
                  <Text style={commonStyles.btnOutlineText}>PDF</Text>
                </Pressable>
              </View>
              {lines.length ? (
                <View style={styles.lines}>
                  {lines.map((line) => (
                    <Text key={line.id} style={styles.lineText}>
                      • {formatPrescriptionItemLine(line)}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text style={[commonStyles.muted, { marginTop: 6 }]}>No medicine lines on file for this Rx.</Text>
              )}
            </View>
          );
        })}
        {!prescriptions.length ? <Text style={commonStyles.emptyState}>No prescriptions on file.</Text> : null}
      </OwnerNeonCard>

      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Vaccinations</Text>
        {vaccinations.map((vaccination, i) => (
          <View
            style={[commonStyles.row, i === vaccinations.length - 1 && commonStyles.rowLast]}
            key={vaccination.id}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{vaccination.vaccine_name}</Text>
              <Text style={commonStyles.muted}>
                Due {vaccination.due_on ?? "—"} · {vaccination.status ?? "—"}
              </Text>
            </View>
          </View>
        ))}
        {!vaccinations.length ? <Text style={commonStyles.emptyState}>No vaccination records.</Text> : null}
      </OwnerNeonCard>

      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Visit reports</Text>
        {visitReports.map((vr, i) => {
          const pdfLabel = visitReportPdfSourceLabel(vr.visit_report_pdf_source);
          return (
          <View style={[styles.fileRow, i === visitReports.length - 1 && styles.fileRowLast]} key={vr.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{vr.pet_name}</Text>
              <Text style={commonStyles.muted}>
                {vr.started_at ? formatClinicDateTime(vr.started_at, clinicTimezone) : "—"}
                {vr.visit_report_pdf_generated_at
                  ? ` · ${pdfLabel} saved ${formatClinicDateTime(vr.visit_report_pdf_generated_at, clinicTimezone)}`
                  : ` · ${pdfLabel}`}
              </Text>
            </View>
            <View style={styles.pdfActions}>
              <Pressable style={commonStyles.btnPrimary} onPress={() => onOpenVisitReport(vr.id)}>
                <Text style={commonStyles.btnPrimaryText}>Open</Text>
              </Pressable>
              {onDownloadVisitReport ? (
                <Pressable style={commonStyles.btnOutline} onPress={() => void onDownloadVisitReport(vr.id)}>
                  <Text style={commonStyles.btnOutlineText}>Save</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );})}
        {!visitReports.length ? <Text style={commonStyles.emptyState}>No visit reports yet.</Text> : null}
      </OwnerNeonCard>

      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Files from visits</Text>
        {attachments.map((attachment, i) => (
          <View style={[styles.fileRow, i === attachments.length - 1 && styles.fileRowLast]} key={attachment.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{attachment.file_name ?? "File"}</Text>
              <Text style={commonStyles.muted}>
                {formatClinicDateTime(attachment.created_at, clinicTimezone)}
                {attachment.visit_id ? ` · Visit ${attachment.visit_id.slice(0, 8)}…` : ""}
              </Text>
            </View>
            <Pressable style={commonStyles.btnPrimary} onPress={() => onOpenAttachment(attachment.id)}>
              <Text style={commonStyles.btnPrimaryText}>Open</Text>
            </Pressable>
          </View>
        ))}
        {!attachments.length ? <Text style={commonStyles.emptyState}>No attachments yet.</Text> : null}
      </OwnerNeonCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  itemTitle: { fontWeight: "700", color: theme.onSurface, fontSize: 15 },
  rxBlock: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  rxBlockLast: { borderBottomWidth: 0 },
  rxHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  lines: { marginTop: 8, paddingLeft: 4, gap: 4 },
  lineText: { fontSize: 13, color: theme.onSurfaceVariant, lineHeight: 20 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  fileRowLast: { borderBottomWidth: 0 },
  pdfActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  disabledBtn: { opacity: 0.4 },
});
