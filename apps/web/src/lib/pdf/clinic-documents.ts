import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFImage } from "pdf-lib";
import { formatClinicDateTime } from "@saasclinics/lib";
import { normalizeInvoiceTemplateLayout } from "@/lib/invoicing/invoice-template";

const PAGE_W = 595;
const PAGE_H = 842;
/** White margin outside the bordered document box (full page is white). */
const BOX_INSET = 24;
/** Padding from box inner edge to content (replaces legacy full-page MARGIN). */
const INNER_PAD = 26;
const L = BOX_INSET + INNER_PAD;
const R = PAGE_W - BOX_INSET - INNER_PAD;
/** @deprecated use L — kept for prescription/footer math where unchanged */
const MARGIN = L;
/** Same as box inset; prescription layout uses this name. */
const OUT_MARGIN = BOX_INSET;
const CONTENT_W = R - L;
const SECTION_GAP_AFTER_BANNER = 22;
const LINE_H = 13;
const MAX_LINE_CHARS = 85;
/** Reserve space at bottom of every page for footer band + disclaimer (prevents overlap). */
const FOOTER_H = 44;

/** Website primary #006c50 + companions (marketing tailwind theme). */
const BRAND_PRIMARY = rgb(0, 108 / 255, 80 / 255);
const BRAND_PRIMARY_DEEP = rgb(0, 76 / 255, 56 / 255);
const CARD_WHITE = rgb(1, 1, 1);
const BOX_BORDER = rgb(0.86, 0.88, 0.9);

const VET_TEAL = BRAND_PRIMARY;
const VET_TEAL_DEEP = BRAND_PRIMARY_DEEP;
const TEXT_MAIN = rgb(0.12, 0.14, 0.16);
const TEXT_MUTED = rgb(0.38, 0.42, 0.45);
const ROW_ALT = rgb(0.93, 0.97, 0.96);
/** Table header: solid brand, white text (reference invoice th). */
const TABLE_HEAD = BRAND_PRIMARY;

/**
 * Standard 14 PDF fonts (Helvetica) encode text as WinAnsi — no ₹, €, smart quotes, etc.
 */
function sanitizePdfText(text: string): string {
  return text
    .replace(/\u211e/g, "Rx") // prescription symbol — WinAnsi / StandardFonts cannot encode U+211E
    .replace(/\u20b9/g, "Rs.")
    .replace(/\u20ac/g, "EUR ")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "--")
    .replace(/\u00a0/g, " ");
}

function currencyLabel(c: string): string {
  const t = sanitizePdfText(c).trim().toUpperCase();
  if (t === "INR" || t === "RS." || !t) return "Rs.";
  return sanitizePdfText(c);
}

/** White page with a single bordered document card (invoice sits inside the box). */
function drawPrintPageFrame(page: { drawRectangle: (o: Record<string, unknown>) => void }) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CARD_WHITE, borderWidth: 0 });
  page.drawRectangle({
    x: BOX_INSET,
    y: BOX_INSET,
    width: PAGE_W - 2 * BOX_INSET,
    height: PAGE_H - 2 * BOX_INSET,
    color: CARD_WHITE,
    borderColor: BOX_BORDER,
    borderWidth: 0.85,
  });
}

function wrapLines(text: string, maxChars: number): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [""];
  const out: string[] = [];
  for (const para of t.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > maxChars) {
        if (cur) out.push(cur);
        cur = w.length > maxChars ? w.slice(0, maxChars) : w;
      } else {
        cur = next;
      }
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [""];
}

type InvoiceLineRow = {
  description: string;
  qty: number;
  unit: number;
  total: number;
};

function drawRight(
  page: { drawText: (t: string, o: Record<string, unknown>) => void },
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  color = TEXT_MAIN
) {
  const t = sanitizePdfText(text);
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: rightX - w, y, size, font, color });
}

export async function buildInvoicePdfBytes(opts: {
  layout: unknown;
  clinicName: string;
  branchLines: string[];
  invoiceNumber: string;
  issuedAt: Date;
  currency: string;
  ownerName: string;
  patientName: string;
  lines: InvoiceLineRow[];
  subtotal: number;
  taxRate: number | null;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  notes?: string | null;
  /** Optional clinic logo (PNG or JPEG bytes). */
  logoBytes?: Uint8Array | null;
}): Promise<Uint8Array> {
  const layout = normalizeInvoiceTemplateLayout(opts.layout);
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawPrintPageFrame(page);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logoImage: PDFImage | null = null;
  if (opts.logoBytes && opts.logoBytes.length > 0) {
    try {
      logoImage = await doc.embedPng(opts.logoBytes);
    } catch {
      try {
        logoImage = await doc.embedJpg(opts.logoBytes);
      } catch {
        logoImage = null;
      }
    }
  }

  const cur = currencyLabel(opts.currency);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    drawPrintPageFrame(page);
    y = PAGE_H - MARGIN;
  };

  const ensureSpace = (need: number) => {
    if (y < MARGIN + FOOTER_H + need) newPage();
  };

  const drawPlain = (text: string, size = 10, bold = false, color = TEXT_MAIN) => {
    for (const line of wrapLines(sanitizePdfText(text), MAX_LINE_CHARS)) {
      ensureSpace(24);
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font: bold ? fontBold : font,
        color,
        maxWidth: CONTENT_W,
      });
      y -= LINE_H * (size / 10);
    }
  };

  const blocks = [...layout.blocks].filter((b) => b.enabled).sort((a, b) => a.order - b.order);
  const hasClinicHeader = blocks.some((b) => b.enabled && b.type === "clinic_header");
  const invoiceMetaInLayout = blocks.some((b) => b.enabled && b.type === "invoice_meta");
  let metaMergedInBanner = false;

  const drawVeterinaryBanner = () => {
    const boxTop = PAGE_H - BOX_INSET;
    const addrRaw = opts.branchLines.map((s) => s.trim()).filter(Boolean);
    const addrLines: string[] = [];
    for (const line of addrRaw) {
      addrLines.push(...wrapLines(line, 54));
    }
    const addrShow = addrLines.slice(0, 5);

    const name = sanitizePdfText(opts.clinicName);
    const nameLines = wrapLines(name, 34).slice(0, 3);
    const nameLineStep = nameLines.length > 1 ? 15 : 18;
    const nameSize = nameLines.length > 1 ? 14 : 17;

    let leftX = L;
    let logoW = 0;
    let logoH = 0;
    if (logoImage) {
      const maxLogo = 50;
      const iw = logoImage.width;
      const ih = logoImage.height;
      const scale = Math.min(maxLogo / iw, maxLogo / ih, 1);
      logoW = iw * scale;
      logoH = ih * scale;
      leftX = L + logoW + 12;
    }

    const nameBlockH = nameLines.length * nameLineStep;
    const addrBlockH = addrShow.length ? 6 + addrShow.length * 11 : 0;
    const bandH = Math.max(logoH > 0 ? logoH + 28 : 0, 16 + nameBlockH + addrBlockH + 18);

    const bannerBottomY = boxTop - bandH;
    page.drawRectangle({
      x: BOX_INSET,
      y: bannerBottomY,
      width: PAGE_W - 2 * BOX_INSET,
      height: bandH,
      color: VET_TEAL,
      borderWidth: 0,
    });

    if (logoImage) {
      page.drawImage(logoImage, {
        x: L,
        y: bannerBottomY + (bandH - logoH) / 2,
        width: logoW,
        height: logoH,
      });
    }

    let cursorY = boxTop - 18;
    for (const nl of nameLines) {
      page.drawText(nl, {
        x: leftX,
        y: cursorY,
        size: nameSize,
        font: fontBold,
        color: rgb(1, 1, 1),
        maxWidth: R - leftX - 130,
      });
      cursorY -= nameLineStep;
    }

    let addrY = cursorY - 6;
    for (const al of addrShow) {
      page.drawText(sanitizePdfText(al), {
        x: leftX,
        y: addrY,
        size: 8.5,
        font,
        color: rgb(1, 1, 1),
        maxWidth: R - leftX - 130,
      });
      addrY -= 11;
    }

    const metaTop = boxTop - 18;
    drawRight(page, "TAX INVOICE", R, metaTop, 9, fontBold, rgb(1, 1, 1));
    drawRight(page, `# ${sanitizePdfText(opts.invoiceNumber)}`, R, metaTop - 13, 10, fontBold, rgb(1, 1, 1));
    drawRight(page, opts.issuedAt.toLocaleString(), R, metaTop - 26, 8, font, rgb(0.96, 1, 0.98));

    y = bannerBottomY - SECTION_GAP_AFTER_BANNER;
    metaMergedInBanner = true;
  };

  const drawInvoiceMetaStandalone = () => {
    drawPlain("Tax invoice", 14, true, VET_TEAL_DEEP);
    drawPlain(`Invoice no: ${opts.invoiceNumber}`, 11, true);
    drawPlain(`Date: ${opts.issuedAt.toLocaleString()}`, 10);
    y -= 6;
  };

  const drawOwnerPatient = () => {
    const ownerLines = wrapLines(`Owner: ${sanitizePdfText(opts.ownerName)}`, 78);
    const patientLines = wrapLines(`Patient: ${sanitizePdfText(opts.patientName)}`, 78);
    const innerLines = 1 + ownerLines.length + patientLines.length;
    const boxH = Math.max(52, 16 + innerLines * LINE_H + 12);
    ensureSpace(boxH + 28);
    y -= 10;

    page.drawRectangle({
      x: L - 4,
      y: y - boxH,
      width: R - L + 8,
      height: boxH,
      color: ROW_ALT,
      borderColor: TABLE_HEAD,
      borderWidth: 0.8,
    });
    const blockTop = y - 14;
    page.drawText("Bill to", { x: L + 6, y: blockTop, size: 8, font: fontBold, color: VET_TEAL_DEEP });
    let lineY = blockTop - 14;
    for (const ol of ownerLines) {
      page.drawText(sanitizePdfText(ol), {
        x: L + 6,
        y: lineY,
        size: 10,
        font: fontBold,
        color: TEXT_MAIN,
        maxWidth: CONTENT_W - 12,
      });
      lineY -= LINE_H;
    }
    for (const pl of patientLines) {
      page.drawText(sanitizePdfText(pl), {
        x: L + 6,
        y: lineY,
        size: 10,
        font,
        color: TEXT_MAIN,
        maxWidth: CONTENT_W - 12,
      });
      lineY -= LINE_H;
    }
    y = y - boxH - 20;
  };

  const drawLineItemsTable = () => {
    const colQty = R - 160;
    const colUnit = R - 105;
    const colAmt = R;

    ensureSpace(48);
    y -= 6;
    page.drawRectangle({
      x: L,
      y: y - 22,
      width: CONTENT_W,
      height: 22,
      color: TABLE_HEAD,
      borderColor: BRAND_PRIMARY_DEEP,
      borderWidth: 0.6,
    });
    const th = rgb(1, 1, 1);
    page.drawText("Description", { x: L + 6, y: y - 14, size: 9, font: fontBold, color: th });
    drawRight(page, "Qty", colQty + 18, y - 14, 9, fontBold, th);
    drawRight(page, `Unit (${cur})`, colUnit + 28, y - 14, 8, fontBold, th);
    drawRight(page, `Amount (${cur})`, colAmt, y - 14, 8, fontBold, th);
    y -= 28;

    let rowIdx = 0;
    for (const row of opts.lines) {
      const descLines = wrapLines(row.description, 48);
      const rowH = Math.max(descLines.length, 1) * LINE_H + 10;
      ensureSpace(rowH + 20);

      const bg = rowIdx % 2 === 0 ? rgb(1, 1, 1) : ROW_ALT;
      page.drawRectangle({
        x: L,
        y: y - rowH + 4,
        width: CONTENT_W,
        height: rowH,
        color: bg,
        borderColor: rgb(0.9, 0.92, 0.92),
        borderWidth: 0.35,
      });

      let lineY = y - 12;
      for (let i = 0; i < descLines.length; i++) {
        page.drawText(sanitizePdfText(descLines[i]), {
          x: L + 6,
          y: lineY,
          size: 9,
          font,
          color: TEXT_MAIN,
          maxWidth: CONTENT_W - 220,
        });
        if (i === 0) {
          drawRight(page, String(row.qty), colQty + 18, lineY, 9, font, TEXT_MAIN);
          drawRight(page, row.unit.toFixed(2), colUnit + 28, lineY, 9, font, TEXT_MAIN);
          drawRight(page, row.total.toFixed(2), colAmt, lineY, 9, fontBold, TEXT_MAIN);
        }
        lineY -= LINE_H;
      }
      y -= rowH;
      rowIdx += 1;
    }
    y -= 8;
  };

  const drawTotals = () => {
    const rightBlock = R - 4;
    const labelX = R - 256;
    ensureSpace(110);
    y -= 12;
    page.drawText("Subtotal", { x: labelX, y, size: 10, font, color: TEXT_MUTED });
    drawRight(page, `${cur} ${opts.subtotal.toFixed(2)}`, rightBlock, y, 10, font, TEXT_MAIN);
    y -= 18;
    if (opts.taxRate != null && opts.taxRate > 0) {
      page.drawText(`Tax (${opts.taxRate}%)`, { x: labelX, y, size: 10, font, color: TEXT_MUTED });
      drawRight(page, `${cur} ${opts.taxTotal.toFixed(2)}`, rightBlock, y, 10, font, TEXT_MAIN);
      y -= 18;
    } else if (opts.taxTotal > 0) {
      page.drawText("Tax", { x: labelX, y, size: 10, font, color: TEXT_MUTED });
      drawRight(page, `${cur} ${opts.taxTotal.toFixed(2)}`, rightBlock, y, 10, font, TEXT_MAIN);
      y -= 18;
    }
    if (opts.discountTotal > 0) {
      page.drawText("Discount", { x: labelX, y, size: 10, font, color: TEXT_MUTED });
      drawRight(page, `-${cur} ${opts.discountTotal.toFixed(2)}`, rightBlock, y, 10, font, TEXT_MAIN);
      y -= 18;
    }
    y -= 8;
    const totalBarH = 26;
    page.drawRectangle({
      x: L - 2,
      y: y - totalBarH,
      width: R - L + 4,
      height: totalBarH,
      color: TABLE_HEAD,
      borderColor: BRAND_PRIMARY_DEEP,
      borderWidth: 0.6,
    });
    const totalMidY = y - totalBarH / 2 - 4;
    page.drawText("Total due", { x: L + 8, y: totalMidY, size: 11, font: fontBold, color: rgb(1, 1, 1) });
    drawRight(page, `${cur} ${opts.grandTotal.toFixed(2)}`, rightBlock, totalMidY, 12, fontBold, rgb(1, 1, 1));
    y = y - totalBarH - 18;
  };

  if (!hasClinicHeader && !invoiceMetaInLayout) {
    drawInvoiceMetaStandalone();
  }

  for (const block of blocks) {
    switch (block.type) {
      case "clinic_header":
        drawVeterinaryBanner();
        break;
      case "invoice_meta":
        if (!metaMergedInBanner) drawInvoiceMetaStandalone();
        break;
      case "owner_patient":
        drawOwnerPatient();
        break;
      case "line_items":
        drawLineItemsTable();
        break;
      case "totals":
        drawTotals();
        break;
      case "footer_note": {
        const foot = (block.customText ?? "").trim();
        if (foot) {
          drawPlain(foot, 9, false, TEXT_MUTED);
          y -= 4;
        }
        break;
      }
      case "custom_text": {
        const title = (block.title ?? "").trim();
        const body = (block.body ?? "").trim();
        if (title) drawPlain(title, 11, true);
        if (body) drawPlain(body, 9);
        y -= 4;
        break;
      }
      default:
        break;
    }
  }

  if (opts.notes?.trim()) {
    y -= 16;
    drawPlain("Notes", 10, true, VET_TEAL_DEEP);
    drawPlain(opts.notes.trim(), 9);
  }

  const footerLine1 =
    "Thank you for your trust. This invoice was generated electronically and is valid without a handwritten signature.";
  const footerLine2 = "Retain for your records. For queries, contact the clinic using the details above.";
  const pages = doc.getPages();
  for (const p of pages) {
    const bandH = 34;
    p.drawRectangle({
      x: BOX_INSET,
      y: BOX_INSET,
      width: PAGE_W - 2 * BOX_INSET,
      height: bandH,
      color: rgb(0.93, 0.96, 0.95),
      borderColor: rgb(0.78, 0.9, 0.86),
      borderWidth: 0.4,
    });
    p.drawText(sanitizePdfText(footerLine1), {
      x: L,
      y: BOX_INSET + 20,
      size: 7,
      font,
      color: TEXT_MUTED,
      maxWidth: CONTENT_W,
    });
    p.drawText(sanitizePdfText(footerLine2), {
      x: L,
      y: BOX_INSET + 9,
      size: 7,
      font,
      color: TEXT_MUTED,
      maxWidth: CONTENT_W,
    });
  }

  return doc.save();
}

export async function buildPrescriptionPdfBytes(opts: {
  clinicName: string;
  petName: string;
  ownerName: string;
  doctorName: string;
  issuedAt: Date;
  clinicTimezone?: string | null;
  /** Optional clinic logo (PNG or JPEG bytes). */
  logoBytes?: Uint8Array | null;
  items: Array<{
    medicine_name: string;
    dosage: string;
    frequency: string | null;
    duration: string | null;
    instructions: string | null;
  }>;
  notes?: string | null;
}): Promise<Uint8Array> {
  const issuedLabel = formatClinicDateTime(opts.issuedAt, opts.clinicTimezone);
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawPrintPageFrame(page);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let logoImage: PDFImage | null = null;
  if (opts.logoBytes && opts.logoBytes.length > 0) {
    try {
      logoImage = await doc.embedPng(opts.logoBytes);
    } catch {
      try {
        logoImage = await doc.embedJpg(opts.logoBytes);
      } catch {
        logoImage = null;
      }
    }
  }
  let y = PAGE_H - MARGIN;

  const newRxPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    drawPrintPageFrame(page);
    y = PAGE_H - MARGIN;
  };

  const draw = (text: string, size = 11, bold = false, x = MARGIN) => {
    for (const line of wrapLines(sanitizePdfText(text), MAX_LINE_CHARS)) {
      if (y < MARGIN + 52) {
        newRxPage();
      }
      page.drawText(line, {
        x,
        y,
        size,
        font: bold ? fontBold : font,
        color: TEXT_MAIN,
      });
      y -= LINE_H * (size / 11);
    }
  };

  const innerW = PAGE_W - 2 * OUT_MARGIN;
  const ACCENT_H = 6;
  const bannerH = 80;
  const topBandBottom = PAGE_H - OUT_MARGIN - ACCENT_H - bannerH;

  page.drawRectangle({
    x: OUT_MARGIN,
    y: PAGE_H - OUT_MARGIN - ACCENT_H,
    width: innerW,
    height: ACCENT_H,
    color: BRAND_PRIMARY_DEEP,
    borderWidth: 0,
  });

  page.drawRectangle({
    x: OUT_MARGIN,
    y: topBandBottom,
    width: innerW,
    height: bannerH,
    color: VET_TEAL,
  });

  let bannerLeft = MARGIN;
  if (logoImage) {
    const maxLogo = 48;
    const scale = Math.min(maxLogo / logoImage.width, maxLogo / logoImage.height, 1);
    const lw = logoImage.width * scale;
    const lh = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: MARGIN,
      y: topBandBottom + (bannerH - lh) / 2,
      width: lw,
      height: lh,
    });
    bannerLeft = MARGIN + lw + 12;
  }
  page.drawText(sanitizePdfText(opts.clinicName), {
    x: bannerLeft,
    y: topBandBottom + bannerH - 28,
    size: 17,
    font: fontBold,
    color: rgb(1, 1, 1),
    maxWidth: PAGE_W - bannerLeft - MARGIN,
  });
  page.drawText("Veterinary prescription", {
    x: bannerLeft,
    y: topBandBottom + bannerH - 48,
    size: 10,
    font: fontBold,
    color: rgb(0.9, 0.98, 0.95),
  });
  drawRight(page, issuedLabel, PAGE_W - MARGIN, topBandBottom + bannerH - 30, 9, font, rgb(0.92, 0.98, 0.96));

  y = topBandBottom - 22;

  const midX = MARGIN + (PAGE_W - 2 * MARGIN) * 0.52;
  const col2 = midX + 8;
  const leftBlock = `Owner: ${opts.ownerName}\nPatient: ${opts.petName}`;
  const rightBlock = `Veterinarian: ${opts.doctorName}\nIssued: ${issuedLabel}`;
  let yL = y;
  let yR = y;
  for (const line of wrapLines(sanitizePdfText(leftBlock), 42)) {
    page.drawText(line, { x: MARGIN, y: yL, size: 10, font: fontBold, color: TEXT_MAIN });
    yL -= LINE_H;
  }
  for (const line of wrapLines(sanitizePdfText(rightBlock), 42)) {
    page.drawText(line, { x: col2, y: yR, size: 10, font, color: TEXT_MAIN });
    yR -= LINE_H;
  }
  y = Math.min(yL, yR) - 14;

  const drawSectionTitle = (title: string) => {
    if (y < MARGIN + 60) newRxPage();
    const titleY = y - 14;
    page.drawRectangle({
      x: MARGIN,
      y: titleY - 1,
      width: 3,
      height: 14,
      color: BRAND_PRIMARY,
      borderWidth: 0,
    });
    page.drawText(sanitizePdfText(title), {
      x: MARGIN + 10,
      y: titleY,
      size: 11,
      font: fontBold,
      color: BRAND_PRIMARY_DEEP,
    });
    y = titleY - 22;
  };

  drawSectionTitle("Rx / Medications");

  for (let i = 0; i < opts.items.length; i++) {
    const it = opts.items[i];
    if (y < MARGIN + 72) newRxPage();
    page.drawText(`${i + 1}. ${sanitizePdfText(it.medicine_name)}`, {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
      color: TEXT_MAIN,
      maxWidth: PAGE_W - 2 * MARGIN,
    });
    y -= LINE_H + 2;
    draw(`   Dosage: ${it.dosage}`, 9, false, MARGIN + 6);
    if (it.frequency) draw(`   Frequency: ${it.frequency}`, 9, false, MARGIN + 6);
    if (it.duration) draw(`   Duration: ${it.duration}`, 9, false, MARGIN + 6);
    if (it.instructions) draw(`   Instructions: ${it.instructions}`, 8, false, MARGIN + 6);
    if (i < opts.items.length - 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - 2,
        width: PAGE_W - 2 * MARGIN,
        height: 1,
        color: rgb(0.85, 0.87, 0.88),
        borderWidth: 0,
      });
      y -= 12;
    }
  }

  if (opts.notes?.trim()) {
    drawSectionTitle("Clinical notes");
    draw(opts.notes.trim(), 9);
  }

  if (y < MARGIN + 80) newRxPage();
  y -= 24;
  page.drawText("Follow-up: as directed by your veterinarian.", {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: TEXT_MUTED,
  });
  y -= 36;
  drawRight(page, "Authorised prescriber (electronic)", PAGE_W - MARGIN, y, 9, font, TEXT_MUTED);

  const pages = doc.getPages();
  for (const p of pages) {
    p.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W,
      height: 30,
      color: rgb(0.93, 0.96, 0.95),
      borderColor: rgb(0.78, 0.9, 0.86),
      borderWidth: 0.35,
    });
    p.drawText(sanitizePdfText("Digitally generated prescription — use only as directed. Not for human use."), {
      x: MARGIN,
      y: 11,
      size: 7,
      font,
      color: TEXT_MUTED,
      maxWidth: PAGE_W - MARGIN * 2,
    });
  }

  return doc.save();
}

export async function buildHandwrittenCanvasPdfBytes(opts: {
  imageBytes: Uint8Array;
  footerText?: string | null;
  logoBytes?: Uint8Array | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  drawPrintPageFrame(page);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  let image: PDFImage;
  try {
    image = await doc.embedPng(opts.imageBytes);
  } catch {
    image = await doc.embedJpg(opts.imageBytes);
  }

  let logoImage: PDFImage | null = null;
  if (opts.logoBytes && opts.logoBytes.length > 0) {
    try {
      logoImage = await doc.embedPng(opts.logoBytes);
    } catch {
      try {
        logoImage = await doc.embedJpg(opts.logoBytes);
      } catch {
        logoImage = null;
      }
    }
  }

  const maxW = PAGE_W - BOX_INSET * 2 - 12;
  const maxH = PAGE_H - BOX_INSET * 2 - 24;
  const scale = Math.min(maxW / image.width, maxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (PAGE_W - width) / 2;
  const y = BOX_INSET + (PAGE_H - BOX_INSET * 2 - height) / 2 + 8;

  page.drawImage(image, { x, y, width, height });

  if (logoImage) {
    const maxLogo = 58;
    const logoScale = Math.min(maxLogo / logoImage.width, maxLogo / logoImage.height, 1);
    const logoWidth = logoImage.width * logoScale;
    const logoHeight = logoImage.height * logoScale;
    page.drawImage(logoImage, {
      x: BOX_INSET + 18,
      y: PAGE_H - BOX_INSET - logoHeight - 16,
      width: logoWidth,
      height: logoHeight,
    });

    const markScale = Math.min(190 / logoImage.width, 190 / logoImage.height, 1.4);
    const markWidth = logoImage.width * markScale;
    const markHeight = logoImage.height * markScale;
    page.drawImage(logoImage, {
      x: PAGE_W - BOX_INSET - markWidth - 28,
      y: BOX_INSET + 96,
      width: markWidth,
      height: markHeight,
      opacity: 0.14,
    });
  }

  const footer = sanitizePdfText(
    opts.footerText?.trim() || "Handwritten clinical sheet captured digitally and exported as a PDF record.",
  );
  page.drawRectangle({
    x: BOX_INSET,
    y: BOX_INSET,
    width: PAGE_W - BOX_INSET * 2,
    height: 22,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: BOX_BORDER,
    borderWidth: 0.35,
  });
  page.drawText(footer, {
    x: L,
    y: BOX_INSET + 8,
    size: 7,
    font,
    color: TEXT_MUTED,
    maxWidth: CONTENT_W,
  });

  return doc.save();
}
