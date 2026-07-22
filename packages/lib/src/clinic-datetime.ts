/** Default when `clinics.timezone` is unset (GreenCoatVets operates in India). */
export const DEFAULT_CLINIC_TIMEZONE = "Asia/Kolkata";

export function resolveClinicTimezone(timezone?: string | null): string {
  const t = timezone?.trim();
  return t || DEFAULT_CLINIC_TIMEZONE;
}

export function formatClinicDateTime(
  iso: string | Date | null | undefined,
  timezone?: string | null,
  locale = "en-IN",
): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    timeZone: resolveClinicTimezone(timezone),
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatClinicDate(
  iso: string | Date | null | undefined,
  timezone?: string | null,
  locale = "en-IN",
): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, {
    timeZone: resolveClinicTimezone(timezone),
    dateStyle: "medium",
  });
}
