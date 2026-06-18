import { NextResponse } from "next/server";
import { sendWebsiteWelcomeEmail } from "@/lib/email/send-welcome-email";
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

    const body = (await request.json()) as { fullName?: string };
    const email = user.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "No email on account." }, { status: 400 });
    }

    const fullName = body.fullName?.trim() || user.user_metadata?.full_name || user.user_metadata?.name || "Pet owner";
    await sendWebsiteWelcomeEmail({ email, fullName });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[mobile/owner-welcome]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to send welcome email." }, { status: 500 });
  }
}
