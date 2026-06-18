import { NextResponse } from "next/server";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { sendNewUserRegistrationNotificationEmail } from "@/lib/email/send-new-user-registration-notification-email";
import { sendWebsiteWelcomeEmail } from "@/lib/email/send-welcome-email";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fullName?: string;
      phone?: string;
    };
    const fullName = (body.fullName ?? "").trim();
    const phone = (body.phone ?? "").trim();
    if (!fullName || !phone) {
      return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
    }

    const clinic = await resolveClinic();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

    const { data: existing } = await supabase
      .from("owners")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (existing) {
      await supabase.rpc("ensure_primary_clinic_customer_membership", {
        p_full_name: fullName,
        p_phone: phone,
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const emailNorm = user.email?.trim().toLowerCase() ?? "";
    if (emailNorm) {
      const { data: guestOwner } = await supabase
        .from("owners")
        .select("id")
        .eq("clinic_id", clinic.id)
        .is("user_id", null)
        .eq("email", emailNorm)
        .limit(1)
        .maybeSingle();

      if (guestOwner?.id) {
        const { error: updErr } = await supabase
          .from("owners")
          .update({
            user_id: user.id,
            full_name: fullName,
            phone,
            email: emailNorm,
          })
          .eq("id", guestOwner.id);
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
        await supabase.rpc("ensure_primary_clinic_customer_membership", {
          p_full_name: fullName,
          p_phone: phone,
        });
        try {
          if (emailNorm) {
            await sendWebsiteWelcomeEmail({ email: emailNorm, fullName });
          }
        } catch (error) {
          console.error("[register-owner] welcome email failed", error);
        }
        try {
          await sendNewUserRegistrationNotificationEmail(supabase, {
            clinicId: clinic.id,
            clinicName: clinic.name,
            fullName,
            email: emailNorm,
            phone,
            registrationSource: "website_owner",
          });
        } catch (error) {
          console.error("[register-owner] admin notification failed", error);
        }
        return NextResponse.json({ ok: true, mergedGuest: true }, { status: 200 });
      }
    }

    const { error } = await supabase.from("owners").insert({
      clinic_id: clinic.id,
      user_id: user.id,
      full_name: fullName,
      phone,
      email: user.email ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase.rpc("ensure_primary_clinic_customer_membership", {
      p_full_name: fullName,
      p_phone: phone,
    });

    try {
      if (emailNorm) {
        await sendWebsiteWelcomeEmail({ email: emailNorm, fullName });
      }
    } catch (mailError) {
      console.error("[register-owner] welcome email failed", mailError);
    }

    try {
      await sendNewUserRegistrationNotificationEmail(supabase, {
        clinicId: clinic.id,
        clinicName: clinic.name,
        fullName,
        email: emailNorm,
        phone,
        registrationSource: "website_owner",
      });
    } catch (error) {
      console.error("[register-owner] admin notification failed", error);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
