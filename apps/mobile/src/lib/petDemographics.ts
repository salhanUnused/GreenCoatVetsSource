/** Aligns with apps/website/src/lib/booking/pet-demographics.ts */
export const PET_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
] as const;

export type PetGenderValue = (typeof PET_GENDER_OPTIONS)[number]["value"];

export function normalizeBookingPetGender(value: string | null | undefined): PetGenderValue | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "male" || normalized === "female" || normalized === "unknown") {
    return normalized;
  }
  return null;
}

/** Website booking requires age > 0 (minimum 1 month). */
export function parseBookingAgeYearsToMonths(value: string | null | undefined): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const years = Number(raw);
  if (!Number.isFinite(years) || years <= 0) return null;
  return Math.max(1, Math.round(years * 12));
}

export function formatBookingAgeYearsLabel(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const years = Number(raw);
  if (!Number.isFinite(years) || years <= 0) return null;
  const formatted = Number.isInteger(years) ? String(years) : years.toFixed(1).replace(/\.0$/, "");
  return `${formatted} year${years === 1 ? "" : "s"}`;
}

/** Prefill age field from DB `age_months`. */
export function monthsToAgeYearsInput(months: number | null | undefined): string {
  if (months == null || !Number.isFinite(months)) return "";
  const y = months / 12;
  return Number.isInteger(y) ? String(y) : y.toFixed(1).replace(/\.0$/, "");
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
