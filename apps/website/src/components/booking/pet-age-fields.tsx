"use client";

import { useId, useState } from "react";
import { BOOKING_AGE_UNIT_OPTIONS, type BookingAgeUnit } from "@/lib/booking/pet-demographics";

type Props = {
  fieldClassName: string;
  name?: string;
  unitName?: string;
  required?: boolean;
  optionalHint?: string;
  defaultUnit?: BookingAgeUnit;
  defaultValue?: string;
  placeholderYears?: string;
  placeholderMonths?: string;
};

export function PetAgeFields({
  fieldClassName,
  name = "pet_age_years",
  unitName = "pet_age_unit",
  required = false,
  optionalHint,
  defaultUnit = "years",
  defaultValue = "",
  placeholderYears = "e.g. 3",
  placeholderMonths = "e.g. 18",
}: Props) {
  const labelId = useId();
  const [unit, setUnit] = useState<BookingAgeUnit>(defaultUnit);

  return (
    <div>
      <label htmlFor={labelId} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">
        Pet age
      </label>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          id={labelId}
          className={fieldClassName}
          name={name}
          type="number"
          min={unit === "months" ? "1" : "0.1"}
          step={unit === "months" ? "1" : "0.1"}
          inputMode={unit === "months" ? "numeric" : "decimal"}
          placeholder={unit === "months" ? placeholderMonths : placeholderYears}
          defaultValue={defaultValue}
          required={required}
        />
        <select
          className={fieldClassName}
          name={unitName}
          value={unit}
          onChange={(e) => setUnit(e.target.value === "months" ? "months" : "years")}
          aria-label="Age unit"
        >
          {BOOKING_AGE_UNIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {optionalHint ? <p className="mt-1 text-xs text-on-surface-variant">{optionalHint}</p> : null}
    </div>
  );
}
