import { supabase } from "./supabase";
import { getWebsiteBaseUrl } from "./store-api";

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sign in required.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/** Same booking confirmation emails as the website owner booking flow. */
export async function notifyAppointmentBookingEmails(input: {
  clinicId: string;
  branchId: string;
  appointmentType: string;
  startsAtIso: string;
  petId: string;
  appointmentId?: string;
  chiefComplaint?: string | null;
  notes?: string | null;
  contactFullName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  signaturePng?: string | null;
  bookingSource?: "owner_portal" | "guest_website";
  documentTitle?: string;
}): Promise<void> {
  const base = getWebsiteBaseUrl();
  if (!base) {
    console.warn("[website-api] EXPO_PUBLIC_WEBSITE_URL not set — skipping booking emails.");
    return;
  }
  const headers = await authHeaders();
  const res = await fetch(`${base}/api/mobile/appointment-booking-notify`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    console.warn("[website-api] booking notify failed:", data.error ?? res.status);
  }
}

/** Welcome email after profile completion — same as website complete-profile. */
export async function sendOwnerWelcomeEmail(fullName: string): Promise<void> {
  const base = getWebsiteBaseUrl();
  if (!base) return;
  const headers = await authHeaders();
  const res = await fetch(`${base}/api/mobile/owner-welcome`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fullName }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    console.warn("[website-api] welcome email failed:", data.error ?? res.status);
  }
}
