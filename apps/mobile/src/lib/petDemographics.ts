/** Aligns with apps/website/src/lib/booking/pet-demographics.ts */
export const PET_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
] as const;

export type PetGenderValue = (typeof PET_GENDER_OPTIONS)[number]["value"];

export const PET_AGE_UNIT_OPTIONS = [
  { value: "years", label: "Years" },
  { value: "months", label: "Months" },
] as const;

export type PetAgeUnit = (typeof PET_AGE_UNIT_OPTIONS)[number]["value"];

export function normalizeBookingPetGender(value: string | null | undefined): PetGenderValue | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "male" || normalized === "female" || normalized === "unknown") {
    return normalized;
  }
  return null;
}

export function normalizePetAgeUnit(value: string | null | undefined): PetAgeUnit {
  return String(value ?? "").trim().toLowerCase() === "months" ? "months" : "years";
}

/** Website booking requires age > 0 (minimum 1 month). */
export function parseBookingAgeToMonths(
  value: string | null | undefined,
  unit: PetAgeUnit | string | null | undefined = "years",
): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const ageUnit = normalizePetAgeUnit(unit);
  if (ageUnit === "months") return Math.max(1, Math.round(amount));
  return Math.max(1, Math.round(amount * 12));
}

/** @deprecated Prefer parseBookingAgeToMonths(value, "years") */
export function parseBookingAgeYearsToMonths(value: string | null | undefined): number | null {
  return parseBookingAgeToMonths(value, "years");
}

export function formatBookingAgeLabel(
  value: string | null | undefined,
  unit: PetAgeUnit | string | null | undefined = "years",
): string | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const ageUnit = normalizePetAgeUnit(unit);
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(/\.0$/, "");
  if (ageUnit === "months") {
    return `${formatted} month${amount === 1 ? "" : "s"}`;
  }
  return `${formatted} year${amount === 1 ? "" : "s"}`;
}

export function formatBookingAgeYearsLabel(value: string | null | undefined): string | null {
  return formatBookingAgeLabel(value, "years");
}

/** Prefill age field from DB `age_months`. */
export function monthsToAgeYearsInput(months: number | null | undefined): string {
  if (months == null || !Number.isFinite(months)) return "";
  const y = months / 12;
  return Number.isInteger(y) ? String(y) : y.toFixed(1).replace(/\.0$/, "");
}

export function monthsToAgeInput(
  months: number | null | undefined,
  unit: PetAgeUnit = "years",
): string {
  if (months == null || !Number.isFinite(months)) return "";
  if (unit === "months") return String(Math.max(0, Math.round(months)));
  return monthsToAgeYearsInput(months);
}

export function formatPetAgeGenderSubtitle(pet: {
  gender?: string | null;
  age_months?: number | null;
}): string {
  const g = pet.gender?.trim();
  const genderLabel = g === "male" ? "Male" : g === "female" ? "Female" : "";
  const m = pet.age_months;
  let agePart = "";
  if (m != null && Number.isFinite(m) && m >= 0) {
    if (m < 24) agePart = `${m} mo`;
    else agePart = `${Math.round((m / 12) * 10) / 10} yr`;
  }
  return [genderLabel, agePart].filter(Boolean).join(" · ");
}

/** @deprecated Use parseBookingAgeYearsToMonths */
export function parseAgeYearsToMonths(yearsText: string): number | null {
  return parseBookingAgeYearsToMonths(yearsText);
}
