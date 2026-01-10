/**
 * Input helper for four-digit year values.
 * Normalizes user input and enforces basic validation rules.
 */

import { useMemo } from "react";
import { Input } from "./ui/input";

export function YearInput({
  id,
  name,
  value,
  onChange,
  disabled = false,
  minYear = 1800,
  maxYear = new Date().getFullYear(),
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minYear?: number;
  maxYear?: number;
}) {
  /** Numeric year input with a selectable datalist. */
  const listId = `${id}-years`;
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) out.push(y);
    return out;
  }, [minYear, maxYear]);

  return (
    <>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        placeholder={String(maxYear)}
        list={listId}
        className="max-w-[220px]"
        disabled={disabled}
      />
      <datalist id={listId}>
        {years.map((y) => (
          <option key={y} value={String(y)} />
        ))}
      </datalist>
    </>
  );
}
