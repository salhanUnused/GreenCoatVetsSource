import { NextResponse } from "next/server";
import { isSignaturePngDataUrl, uploadBookingConsentPdf } from "@/lib/booking/persist-booking-consent";
import { sendAppointmentBookingNotificationEmail } from "@/lib/email/send-appointment-booking-notification-email";
import { createClientFromRouteRequest } from "@/lib/supabase/route-request-client";

export async function POST(request: Request) {
  try {
    const supabase = createClientFromRouteRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      clinicId?: string;
      branchId?: string;
      appointmentId?: string;
      appointmentType?: string;
      startsAtIso?: string;
      petId?: string;
      chiefComplaint?: string | null;
      notes?: string | null;
      contactFullName?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
      signaturePng?: string | null;
      bookingSource?: "owner_portal" | "guest_website";
      documentTitle?: string;
    };

    const clinicId = body.clinicId?.trim();
    const branchId = body.branchId?.trim();
    const startsAtIso = body.startsAtIso?.trim();
    const petId = body.petId?.trim();
    const appointmentId = body.appointmentId?.trim();
    const appointmentType = body.appointmentType?.trim() || "consultation";
    const signaturePng = body.signaturePng?.trim() || "";

    if (!clinicId || !branchId || !startsAtIso || !petId) {
      return NextResponse.json({ error: "clinicId, branchId, startsAtIso, and petId are required." }, { status: 400 });
    }

    const [{ data: clinic }, { data: branch }, { data: pet }, { data: owner }] = await Promise.all([
      supabase.from("clinics").select("name").eq("id", clinicId).maybeSingle(),
      supabase.from("branches").select("name").eq("id", branchId).maybeSingle(),
      supabase.from("pets").select("name, owner_id, species").eq("id", petId).eq("clinic_id", clinicId).maybeSingle(),
      supabase
        .from("owners")
        .select("full_name, phone, email")
        .eq("clinic_id", clinicId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!pet?.owner_id) {
      return NextResponse.json({ error: "Pet not found." }, { status: 404 });
    }

    const clinicName = (clinic?.name as string | undefined)?.trim() || "Clinic";
    const petName = (pet.name as string | undefined)?.trim() || "Pet";
    const ownerDisplay = body.contactFullName?.trim() || owner?.full_name?.trim() || "Pet owner";
    const ownerPhone = body.contactPhone?.trim() || owner?.phone?.trim() || null;
    const ownerEmail = (body.contactEmail?.trim() || owner?.email?.trim() || user.email || "").toLowerCase() || null;

    let consentPdfAttachment: { filename: string; content: Buffer } | null = null;
    if (appointmentId && isSignaturePngDataUrl(signaturePng)) {
      const uploaded = await uploadBookingConsentPdf({
        supabase,
        clinicId,
        appointmentId,
        clinicName,
        ownerName: ownerDisplay,
        petName,
        petSpecies: (pet.species as string | null) ?? null,
        chiefComplaint: body.chiefComplaint ?? null,
        appointmentAtIso: startsAtIso,
        signaturePngBase64: signaturePng,
        documentTitle: body.documentTitle ?? "Appointment booking consent",
      });
      if (uploaded) {
        consentPdfAttachment = {
          filename: `consent-${petName.replace(/\s+/g, "-").toLowerCase()}.pdf`,
          content: uploaded.buffer,
        };
      }
    }

    const result = await sendAppointmentBookingNotificationEmail({
      clinicId,
      clinicName,
      branchName: (branch?.name as string | undefined)?.trim() || branchId,
      appointmentType,
      startsAtIso,
      petName,
      ownerDisplay,
      ownerEmail,
      ownerPhone,
      chiefComplaint: body.chiefComplaint ?? null,
      notes: body.notes ?? null,
      bookingSource: body.bookingSource ?? "owner_portal",
      consentPdfAttachment,
    });

    return NextResponse.json({ ok: true, sent: result.sent, reason: result.reason ?? null, hasConsentPdf: Boolean(consentPdfAttachment) });
  } catch (e) {
    console.error("[mobile/appointment-booking-notify]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to send booking emails." }, { status: 500 });
  }
}
