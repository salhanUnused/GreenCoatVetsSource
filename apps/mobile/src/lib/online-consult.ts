import { getWebsiteBaseUrl } from "./store-api";

const DEFAULT_WEBSITE = "https://greencoatvets.com";

export function buildDoctorVideoJoinUrl(appointmentId: string, doctorToken: string): string {
  const base = getWebsiteBaseUrl() ?? DEFAULT_WEBSITE;
  return `${base}/consult/room/${appointmentId}?role=doctor&doctor_token=${encodeURIComponent(doctorToken)}`;
}
