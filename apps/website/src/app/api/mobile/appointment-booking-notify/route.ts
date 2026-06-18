import { NextResponse } from "next/server";
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
      appointmentType?: string;
      startsAtIso?: string;
      petId?: string;
      chiefComplaint?: string | null;
      notes?: string | null;
      contactFullName?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
    };

    const clinicId = body.clinicId?.trim();
    const branchId = body.branchId?.trim();
    const startsAtIso = body.startsAtIso?.trim();
    const petId = body.petId?.trim();
    const appointmentType = body.appointmentType?.trim() || "consultation";

    if (!clinicId || !branchId || !startsAtIso || !petId) {
      return NextResponse.json({ error: "clinicId, branchId, startsAtIso, and petId are required." }, { status: 400 });
    }

    const [{ data: clinic }, { data: branch }, { data: pet }, { data: owner }] = await Promise.all([
      supabase.from("clinics").select("name").eq("id", clinicId).maybeSingle(),
      supabase.from("branches").select("name").eq("id", branchId).maybeSingle(),
      supabase.from("pets").select("name, owner_id").eq("id", petId).eq("clinic_id", clinicId).maybeSingle(),
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

    const ownerDisplay = body.contactFullName?.trim() || owner?.full_name?.trim() || "Pet owner";
    const ownerPhone = body.contactPhone?.trim() || owner?.phone?.trim() || null;
    const ownerEmail = (body.contactEmail?.trim() || owner?.email?.trim() || user.email || "").toLowerCase() || null;

    const result = await sendAppointmentBookingNotificationEmail({
      clinicId,
      clinicName: (clinic?.name as string | undefined)?.trim() || "Clinic",
      branchName: (branch?.name as string | undefined)?.trim() || branchId,
      appointmentType,
      startsAtIso,
      petName: (pet.name as string | undefined)?.trim() || "Pet",
      ownerDisplay,
      ownerEmail,
      ownerPhone,
      chiefComplaint: body.chiefComplaint ?? null,
      notes: body.notes ?? null,
      bookingSource: "owner_portal",
    });

    return NextResponse.json({ ok: true, sent: result.sent, reason: result.reason ?? null });
  } catch (e) {
    console.error("[mobile/appointment-booking-notify]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to send booking emails." }, { status: 500 });
  }
}
