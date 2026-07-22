import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatClinicDateTime } from "@saasclinics/lib";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawWrappedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  color = rgb(0.1, 0.2, 0.16),
  lineHeight = 1.45,
): number {
  let cursorY = y;
  for (const line of wrapLines(text, font, size, maxWidth)) {
    if (line) {
      page.drawText(line, { x, y: cursorY, size, font, color, maxWidth });
    }
    cursorY -= size * lineHeight;
  }
  return cursorY;
}

export type BookingConsentPdfInput = {
  clinicName: string;
  ownerName: string;
  petName: string;
  petSpecies?: string | null;
  chiefComplaint?: string | null;
  appointmentAtIso?: string | null;
  signedAtIso: string;
  consentText: string;
  signaturePngBase64?: string | null;
  /** Header title shown on the PDF */
  documentTitle?: string;
  /** Smaller subtitle under the title */
  documentSubtitle?: string;
  footerLabel?: string;
  clinicTimezone?: string | null;
};

/** Signed consent PDF for clinic bookings, walk-ins, and online consults. */
export async function buildBookingConsentPdf(input: BookingConsentPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(0.05, 0.55, 0.41);
  const muted = rgb(0.35, 0.45, 0.42);
  const title = input.documentTitle?.trim() || "Appointment booking consent";
  const subtitle = input.documentSubtitle?.trim() || "Signed consent form";

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 96, width: PAGE_WIDTH, height: 96, color: teal });
  page.drawText(title, {
    x: MARGIN,
    y: PAGE_HEIGHT - 52,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
    maxWidth: CONTENT_WIDTH,
  });
  page.drawText(subtitle, {
    x: MARGIN,
    y: PAGE_HEIGHT - 74,
    size: 11,
    font,
    color: rgb(0.9, 0.98, 0.95),
  });

  let y = PAGE_HEIGHT - 128;
  const drawLabelValue = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), { x: MARGIN, y, size: 8, font: bold, color: muted });
    y -= 14;
    page.drawText(value, { x: MARGIN, y, size: 12, font: bold, color: rgb(0.08, 0.18, 0.14), maxWidth: CONTENT_WIDTH });
    y -= 22;
  };

  drawLabelValue("Clinic", input.clinicName);
  drawLabelValue("Pet owner", input.ownerName);
  drawLabelValue("Patient (pet)", `${input.petName}${input.petSpecies ? ` · ${input.petSpecies}` : ""}`);
  if (input.appointmentAtIso) {
    drawLabelValue("Appointment time", formatClinicDateTime(input.appointmentAtIso, input.clinicTimezone));
  }
  if (input.chiefComplaint?.trim()) {
    drawLabelValue("Chief complaint", input.chiefComplaint.trim());
  }
  drawLabelValue("Signed on", formatClinicDateTime(input.signedAtIso, input.clinicTimezone));

  y -= 4;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.86, 0.93, 0.9),
  });
  y -= 22;

  page.drawText("CONSENT STATEMENT", { x: MARGIN, y, size: 10, font: bold, color: teal });
  y -= 18;
  y = drawWrappedText(page, font, input.consentText, MARGIN, y, 10, CONTENT_WIDTH, rgb(0.12, 0.22, 0.18), 1.5);

  y -= 12;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.86, 0.93, 0.9),
  });
  y -= 20;
  page.drawText("OWNER SIGNATURE", { x: MARGIN, y, size: 10, font: bold, color: teal });
  y -= 16;

  if (input.signaturePngBase64?.startsWith("data:image/png")) {
    try {
      const raw = input.signaturePngBase64.split(",")[1];
      const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      const img = await doc.embedPng(bytes);
      const maxW = 220;
      const scale = Math.min(maxW / img.width, 80 / img.height, 1);
      const width = img.width * scale;
      const height = img.height * scale;
      page.drawRectangle({
        x: MARGIN - 4,
        y: y - height - 8,
        width: width + 8,
        height: height + 16,
        borderColor: rgb(0.82, 0.9, 0.86),
        borderWidth: 1,
        color: rgb(0.98, 0.99, 0.98),
      });
      page.drawImage(img, { x: MARGIN, y: y - height, width, height });
      y -= height + 24;
    } catch {
      y = drawWrappedText(page, font, "(Signature image could not be embedded.)", MARGIN, y, 10, CONTENT_WIDTH);
    }
  } else {
    y = drawWrappedText(page, font, "(No signature image provided.)", MARGIN, y, 10, CONTENT_WIDTH);
  }

  page.drawText("I confirm that I have read and agree to the consent statement above.", {
    x: MARGIN,
    y: Math.max(72, y - 8),
    size: 9,
    font: bold,
    color: rgb(0.12, 0.22, 0.18),
    maxWidth: CONTENT_WIDTH,
  });

  page.drawText(input.footerLabel?.trim() || `${input.clinicName} · Booking consent`, {
    x: MARGIN,
    y: 36,
    size: 8,
    font,
    color: muted,
  });

  return doc.save();
}

/** @deprecated Prefer buildBookingConsentPdf — kept for online-consult call sites. */
export async function buildOnlineConsultConsentPdf(
  input: Omit<BookingConsentPdfInput, "documentTitle" | "documentSubtitle" | "footerLabel">,
): Promise<Uint8Array> {
  return buildBookingConsentPdf({
    ...input,
    documentTitle: "Senior Veterinarian Online Consultation",
    documentSubtitle: "Signed consent form",
    footerLabel: `${input.clinicName} · Senior Vet online consultation consent`,
  });
}
