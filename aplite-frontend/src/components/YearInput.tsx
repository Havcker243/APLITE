import React, { useMemo } from "react";

export function YearInput({
  id,
  name,
  value,
  onChange,
  minYear = 1800,
  maxYear = new Date().getFullYear(),
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  minYear?: number;
  maxYear?: number;
}) {
  const listId = `${id}-years`;
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) out.push(y);
    return out;
  }, [minYear, maxYear]);

  return (
    <>
      <input
        id={id}
        name={name}
        className="input-control"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        placeholder={String(maxYear)}
        list={listId}
        style={{ maxWidth: 220 }}
      />
      <datalist id={listId}>
        {years.map((y) => (
          <option key={y} value={String(y)} />
        ))}
      </datalist>
    </>
  );
}

