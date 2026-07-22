export type VisitReportPdfSource = "generated" | "handwritten" | "photo_sheet" | string | null | undefined;

/** User-facing label for `visits.visit_report_pdf_source`. */
export function visitReportPdfSourceLabel(source: VisitReportPdfSource): string {
  switch (source) {
    case "handwritten":
      return "Digital sheet";
    case "photo_sheet":
      return "Photo sheet";
    case "generated":
      return "Visit report";
    default:
      return "Visit PDF";
  }
}
