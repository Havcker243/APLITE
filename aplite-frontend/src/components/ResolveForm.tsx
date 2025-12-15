import React from "react";

export type ResolveFormProps = {
  upi: string;
  rail: "ACH" | "WIRE_DOM" | "SWIFT";
  loading: boolean;
  onUpiChange: (value: string) => void;
  onRailChange: (value: "ACH" | "WIRE_DOM" | "SWIFT") => void;
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
            placeholder="NS01ABCDXXXX"
            value={upi}
            onChange={(event) => onUpiChange(event.target.value.toUpperCase())}
            className="input-control"
            minLength={14}
            maxLength={14}
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="rail">
            Rail
          </label>
          <select
            id="rail"
            name="rail"
            value={rail}
            onChange={(event) => onRailChange(event.target.value as "ACH" | "WIRE_DOM" | "SWIFT")}
            className="input-control"
          >
            <option value="ACH">ACH</option>
            <option value="WIRE_DOM">WIRE_DOM</option>
            <option value="SWIFT">SWIFT</option>
          </select>
        </div>
      </div>

      <button type="submit" className="button" disabled={loading}>
        {loading && <span className="spinner" aria-hidden="true" />}
        Resolve UPI
      </button>
    </form>
  );
}
