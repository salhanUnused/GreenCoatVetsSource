export const BOOKING_PET_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
] as const;

export type BookingPetGender = (typeof BOOKING_PET_GENDER_OPTIONS)[number]["value"];

export const BOOKING_AGE_UNIT_OPTIONS = [
  { value: "years", label: "Years" },
  { value: "months", label: "Months" },
] as const;

export type BookingAgeUnit = (typeof BOOKING_AGE_UNIT_OPTIONS)[number]["value"];

export function normalizeBookingPetGender(value: string | null | undefined): BookingPetGender | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "male" || normalized === "female" || normalized === "unknown") {
    return normalized;
  }
  return null;
}

export function normalizeBookingAgeUnit(value: string | null | undefined): BookingAgeUnit {
  return String(value ?? "").trim().toLowerCase() === "months" ? "months" : "years";
}

/** Convert a user-entered age value to whole months stored on pets.age_months. */
export function parseBookingAgeToMonths(
  value: string | null | undefined,
  unit: BookingAgeUnit | string | null | undefined = "years",
): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const ageUnit = normalizeBookingAgeUnit(unit);
  if (ageUnit === "months") return Math.max(1, Math.round(amount));
  return Math.max(1, Math.round(amount * 12));
}

/** @deprecated Prefer parseBookingAgeToMonths(value, "years") */
export function parseBookingAgeYearsToMonths(value: string | null | undefined): number | null {
  return parseBookingAgeToMonths(value, "years");
}

export function formatBookingAgeLabel(
  value: string | null | undefined,
  unit: BookingAgeUnit | string | null | undefined = "years",
): string | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const ageUnit = normalizeBookingAgeUnit(unit);
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(/\.0$/, "");
  if (ageUnit === "months") {
    return `${formatted} month${amount === 1 ? "" : "s"}`;
  }
  return `${formatted} year${amount === 1 ? "" : "s"}`;
}

/** @deprecated Prefer formatBookingAgeLabel(value, "years") */
export function formatBookingAgeYearsLabel(value: string | null | undefined): string | null {
  return formatBookingAgeLabel(value, "years");
}
