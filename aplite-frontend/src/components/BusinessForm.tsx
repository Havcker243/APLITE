import React, { useState } from "react";

export type BusinessFormData = {
  legal_name: string;
  ein: string;
  business_type: string;
  website: string;
  address: string;
  country: string;
  bank_name: string;
  ach_routing: string;
  ach_account: string;
  wire_routing: string;
  wire_account: string;
};

export type BusinessFormProps = {
  form: BusinessFormData;
  loading: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

type SensitiveInputProps = {
  name: keyof BusinessFormData;
  label: string;
  placeholder: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

function SensitiveInput({ name, label, placeholder, value, onChange }: SensitiveInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="input-group">
      <label className="input-label" htmlFor={name}>
        {label}
      </label>
      <div className="input-with-action">
        <input
          id={name}
          type={visible ? "text" : "password"}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="input-control"
          inputMode="numeric"
          autoComplete="off"
          required
        />
        <button type="button" className="action-button" onClick={() => setVisible((prev) => !prev)} aria-label="Toggle visibility">
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export function BusinessForm({ form, loading, onChange, onSubmit }: BusinessFormProps) {
  return (
    <form onSubmit={onSubmit} className="card form-card">
      <div className="section-title">Business Information</div>
      <div className="form-grid">
        <div className="input-group">
          <label className="input-label" htmlFor="legal_name">
            Legal Name
          </label>
          <input id="legal_name" type="text" name="legal_name" value={form.legal_name} onChange={onChange} className="input-control" required />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="ein">
            EIN
          </label>
          <input
            id="ein"
            type="text"
            name="ein"
            placeholder="12-3456789"
            value={form.ein}
            onChange={onChange}
            className="input-control"
            autoComplete="off"
            inputMode="numeric"
            maxLength={10}
            required
          />
          <small className="input-label">Use NN-NNNNNNN format</small>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="business_type">
            Business Type
          </label>
          <input id="business_type" type="text" name="business_type" value={form.business_type} onChange={onChange} className="input-control" required />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="website">
            Website (optional)
          </label>
          <input id="website" type="url" name="website" value={form.website} onChange={onChange} className="input-control" placeholder="https://example.com" />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="address">
            Address
          </label>
          <input id="address" type="text" name="address" value={form.address} onChange={onChange} className="input-control" required />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="country">
            Country
          </label>
          <input id="country" type="text" name="country" value={form.country} onChange={onChange} className="input-control" required />
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 32 }}>
        Banking Information
      </div>
      <div className="form-grid">
        <div className="input-group">
          <label className="input-label" htmlFor="bank_name">
            Bank Name
          </label>
          <input id="bank_name" type="text" name="bank_name" value={form.bank_name} onChange={onChange} className="input-control" required />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="ach_routing">
            ACH Routing Number
          </label>
          <input
            id="ach_routing"
            type="text"
            name="ach_routing"
            placeholder="9 digits"
            value={form.ach_routing}
            onChange={onChange}
            className="input-control"
            autoComplete="off"
            inputMode="numeric"
            maxLength={9}
            required
          />
          <small className="input-label">Enter exactly 9 digits</small>
        </div>

        <SensitiveInput name="ach_account" label="ACH Account Number" placeholder="Account number" value={form.ach_account} onChange={onChange} />

        <div className="input-group">
          <label className="input-label" htmlFor="wire_routing">
            Wire Routing Number
          </label>
          <input id="wire_routing" type="text" name="wire_routing" value={form.wire_routing} onChange={onChange} className="input-control" required />
        </div>

        <SensitiveInput name="wire_account" label="Wire Account Number" placeholder="Account number" value={form.wire_account} onChange={onChange} />
      </div>

      <button type="submit" className="button" disabled={loading}>
        {loading ? "Processing..." : "Generate UPI"}
      </button>
    </form>
  );
}
