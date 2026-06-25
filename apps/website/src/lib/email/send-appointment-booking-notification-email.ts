import { createClient } from "@/lib/supabase/server";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createHostingerTransport, getHostingerFromAddress, resolveClinicNotificationRecipients } from "./hostinger-mail";
import { renderBrandedEmail, type EmailCta } from "./render-branded-email";

/** Hard cap so a stuck SMTP connection can never hang the booking request (and crash the page on serverless timeout). */
const MAIL_SEND_TIMEOUT_MS = 7000;

type Transport = NonNullable<ReturnType<typeof createHostingerTransport>>;
type MailOptions = Parameters<Transport["sendMail"]>[0];

async function sendMailWithTimeout(transporter: Transport, options: MailOptions): Promise<void> {
  await Promise.race([
    transporter.sendMail(options),
    new Promise((_, reject) => setTimeout(() => reject(new Error("mail_send_timeout")), MAIL_SEND_TIMEOUT_MS)),
  ]);
}

export async function sendAppointmentBookingNotificationEmail(params: {
  clinicId: string;
  clinicName: string;
  branchName: string;
  appointmentType: string;
  startsAtIso: string;
  petName: string;
  ownerDisplay: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  chiefComplaint?: string | null;
  notes?: string | null;
  bookingSource: "owner_portal" | "guest_website";
  /** Guest booking confirmation / claim code (merge_token). */
  bookingCode?: string | null;
  /** Signed consent PDF attached to staff/admin notification emails. */
  consentPdfAttachment?: { filename: string; content: Buffer } | null;
  /** Action buttons for staff (e.g. owner/doctor video room) — URLs hidden behind labels. */
  staffCtas?: EmailCta[];
}): Promise<{ sent: boolean; reason?: string }> {
  const supabase = createClient();
  const transporter = createHostingerTransport();
  const from = getHostingerFromAddress();
  if (!transporter || !from) return { sent: false, reason: "smtp_not_configured" };

  const [branding, recipients] = await Promise.all([
    getPlatformBranding(),
    resolveClinicNotificationRecipients(supabase, params.clinicId, [
      "clinic_admin",
      "branch_admin",
      "receptionist",
      "doctor",
      "senior_doctor",
    ]),
  ]);
  if (!recipients.length && !params.ownerEmail?.trim()) return { sent: false, reason: "no_recipient" };

  const branchName = params.branchName.trim() || "—";
  const when = new Date(params.startsAtIso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const sourceLabel = params.bookingSource === "guest_website" ? "Guest (website)" : "Signed-in owner";
  const brandName = branding.product_name || params.clinicName;
  const bookingCode = params.bookingCode?.trim() || null;

  if (recipients.length) {
    const staffMail = renderBrandedEmail({
      brandName,
      heading: "New appointment booked",
      intro: `${params.ownerDisplay} has just booked an appointment through the website.`,
      body: [`This booking came from ${sourceLabel.toLowerCase()} and is now ready for clinic follow-up.`],
      details: [
        { label: "Clinic", value: params.clinicName },
        { label: "Branch", value: branchName },
        { label: "When", value: when },
        { label: "Appointment type", value: params.appointmentType },
        { label: "Pet", value: params.petName },
        { label: "Owner", value: params.ownerDisplay },
        { label: "Owner email", value: params.ownerEmail?.trim() || "—" },
        { label: "Owner phone", value: params.ownerPhone?.trim() || "—" },
        { label: "Chief complaint", value: params.chiefComplaint?.trim() || "—" },
        { label: "Notes", value: params.notes?.trim() || "—" },
        ...(bookingCode ? [{ label: "Booking code", value: bookingCode }] : []),
      ],
      ctas: params.staffCtas,
      footer: `${brandName} booking notifications`,
    });

    const staffAttachments = params.consentPdfAttachment
      ? [
          {
            filename: params.consentPdfAttachment.filename,
            content: params.consentPdfAttachment.content,
            contentType: "application/pdf",
          },
        ]
      : undefined;

    await Promise.allSettled(
      recipients.map((recipient) =>
        sendMailWithTimeout(transporter, {
          from,
          to: recipient,
          replyTo: params.ownerEmail?.trim() || undefined,
          subject: `[${params.clinicName}] New appointment: ${params.petName} · ${when}`,
          text: staffMail.text,
          html: staffMail.html,
          attachments: staffAttachments,
        }),
      ),
    );
  }

  const ownerEmail = params.ownerEmail?.trim().toLowerCase();
  if (ownerEmail) {
    const ownerMail = renderBrandedEmail({
      brandName,
      heading: "Your appointment is booked",
      intro: `Hi ${params.ownerDisplay}, your ${params.appointmentType} booking for ${params.petName} has been received.`,
      body: [
        "The clinic team can now see this appointment in their schedule and will prepare for your visit.",
        bookingCode
          ? `Your booking code is ${bookingCode}. Keep it to manage this appointment in your account or when contacting the clinic.`
          : null,
      ].filter(Boolean) as string[],
      details: [
        { label: "Clinic", value: params.clinicName },
        { label: "Branch", value: branchName },
        { label: "When", value: when },
        { label: "Appointment type", value: params.appointmentType },
        { label: "Pet", value: params.petName },
        { label: "Booked from", value: sourceLabel },
        ...(bookingCode ? [{ label: "Booking code", value: bookingCode }] : []),
      ],
      footer: `${brandName} appointment confirmation`,
    });

    await Promise.allSettled([
      sendMailWithTimeout(transporter, {
        from,
        to: ownerEmail,
        subject: `${params.clinicName} appointment confirmed for ${params.petName}`,
        text: ownerMail.text,
        html: ownerMail.html,
      }),
    ]);
  }

  return { sent: true };
}
