import React from "react";

export type ResolveFormProps = {
  upi: string;
  rail: "ACH" | "WIRE_DOM";
  loading: boolean;
  onUpiChange: (value: string) => void;
  onRailChange: (value: "ACH" | "WIRE_DOM") => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function ResolveForm({ upi, rail, loading, onUpiChange, onRailChange, onSubmit }: ResolveFormProps) {
  return (
    <form onSubmit={onSubmit} className="card form-card" style={{ maxWidth: 520 }}>
      <div className="form-grid">
        <div className="input-group">
          <label className="input-label" htmlFor="upi">
            UPI Identifier
          </label>
          <input
            id="upi"
            type="text"
            name="upi"
            placeholder="AA1B2401"
            value={upi}
            onChange={(event) => onUpiChange(event.target.value.toUpperCase())}
            className="input-control"
            minLength={8}
            maxLength={8}
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="rail">
            Rail
          </label>
          <select id="rail" name="rail" value={rail} onChange={(event) => onRailChange(event.target.value as "ACH" | "WIRE_DOM")}
            className="input-control">
            <option value="ACH">ACH</option>
            <option value="WIRE_DOM">WIRE_DOM</option>
          </select>
        </div>
      </div>

      <button type="submit" className="button" disabled={loading}>
        {loading ? "Resolving..." : "Resolve UPI"}
      </button>
    </form>
  );
}
