/** Parse catalog strings like "10 mg/kg", "0.5 ml/kg", or plain "250 mg". */
export function parseDosagePerKg(raw: string | null | undefined): { amount: number; unit: string } | null {
  const text = (raw ?? "").trim().toLowerCase();
  if (!text) return null;
  const perKg = text.match(/^([\d.]+)\s*([a-zµμ/%]+(?:\/[a-z]+)?)\s*\/\s*kg\s*$/i);
  if (perKg) {
    const amount = Number(perKg[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { amount, unit: perKg[2]!.trim() };
  }
  return null;
}

export function formatDosageForPetWeight(
  dosagePerKg: string | null | undefined,
  weightKg: number | null | undefined,
  fallbackDosage?: string | null,
): string | null {
  const parsed = parseDosagePerKg(dosagePerKg);
  if (!parsed || weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return (fallbackDosage ?? "").trim() || null;
  }
  const total = parsed.amount * weightKg;
  const rounded = total >= 10 ? Math.round(total * 10) / 10 : Math.round(total * 100) / 100;
  return `${rounded} ${parsed.unit} (for ${weightKg} kg)`;
}

export type CatalogMedicine = {
  name: string;
  default_dosage: string | null;
  dosage_per_kg: string | null;
  default_frequency: string | null;
  default_duration: string | null;
};
