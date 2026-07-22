"use client";

const PRESETS: Array<{ label: string; field: "dosage_per_kg" | "default_dosage"; value: string }> = [
  { label: "5 mg/kg", field: "dosage_per_kg", value: "5 mg/kg" },
  { label: "10 mg/kg", field: "dosage_per_kg", value: "10 mg/kg" },
  { label: "0.1 ml/kg", field: "dosage_per_kg", value: "0.1 ml/kg" },
  { label: "250 mg", field: "default_dosage", value: "250 mg" },
  { label: "1 tablet", field: "default_dosage", value: "1 tablet" },
];

/** Quick-fill standard dosage values into the surrounding catalog form. */
export function MedicineDosagePresets() {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((preset) => (
        <button
          key={`${preset.field}-${preset.value}`}
          type="button"
          className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1 text-[11px] font-semibold text-on-surface hover:border-primary/40"
          onClick={(e) => {
            const form = e.currentTarget.form;
            if (!form) return;
            const input = form.elements.namedItem(preset.field) as HTMLInputElement | null;
            if (input) {
              input.value = preset.value;
              input.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
