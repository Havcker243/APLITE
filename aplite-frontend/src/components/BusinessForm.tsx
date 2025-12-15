import React, { useState } from "react";

export type BusinessFormData = {
  legal_name: string;
  ein: string;
  business_type: string;
  website: string;
  address: string;
  country: string;
  account_mode: "existing" | "new";
  payment_account_id: string;
  rail: "ACH" | "WIRE_DOM" | "SWIFT";
  bank_name: string;
  account_name: string;
  ach_routing: string;
  ach_account: string;
  wire_routing: string;
  wire_account: string;
  bank_address: string;
  swift_bic: string;
  iban: string;
  bank_country: string;
  bank_city: string;
};

export type BusinessFormProps = {
  form: BusinessFormData;
  accounts: Array<{ id: number; rail: string; bank_name: string; account_name?: string }>;
  loading: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
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

export function BusinessForm({ form, loading, accounts, onChange, onSubmit }: BusinessFormProps) {
  const selectedAccount = accounts.find((acc) => String(acc.id) === form.payment_account_id);

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
        Payment Account
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div className="input-group">
          <label className="input-label">Account Source</label>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
              <input type="radio" name="account_mode" value="new" checked={form.account_mode === "new"} onChange={onChange} />
              <span className="input-label">New account</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
              <input type="radio" name="account_mode" value="existing" checked={form.account_mode === "existing"} onChange={onChange} />
              <span className="input-label">Use stored</span>
            </label>
          </div>
          <small className="input-label">Pick a saved account to auto-fill, or enter new details.</small>
        </div>

        {form.account_mode === "existing" && (
          <div className="input-group">
            <label className="input-label" htmlFor="payment_account_id">
              Saved Accounts
            </label>
            <select id="payment_account_id" name="payment_account_id" value={form.payment_account_id} onChange={onChange} className="input-control" required>
              <option value="">Select an account…</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} • {account.rail} • {account.account_name || `Account ${account.id}`}
                </option>
              ))}
            </select>
            <small className="input-label">Manage stored accounts in the Accounts tab.</small>
          </div>
        )}
      </div>

      {form.account_mode === "existing" && selectedAccount && (
        <div className="card" style={{ background: "rgba(255,255,255,0.02)", borderColor: "var(--card-border)", marginTop: 10 }}>
          <div className="section-title" style={{ marginBottom: 6 }}>
            Using stored account
          </div>
          <div className="history-meta">
            {selectedAccount.bank_name} • {selectedAccount.account_name || `Account ${selectedAccount.id}`} • {selectedAccount.rail}
          </div>
        </div>
      )}

      {form.account_mode === "new" && (
        <>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div className="input-group">
              <label className="input-label" htmlFor="rail">
                Rail
              </label>
              <select id="rail" name="rail" value={form.rail} onChange={onChange} className="input-control">
                <option value="ACH">ACH</option>
                <option value="WIRE_DOM">WIRE_DOM</option>
                <option value="SWIFT">SWIFT</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="bank_name">
                Bank Name
              </label>
              <input id="bank_name" type="text" name="bank_name" value={form.bank_name} onChange={onChange} className="input-control" required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="account_name">
                Account Name
              </label>
              <input id="account_name" type="text" name="account_name" value={form.account_name} onChange={onChange} className="input-control" placeholder={form.legal_name} />
            </div>
          </div>

          {form.rail === "ACH" && (
            <div className="form-grid">
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
            </div>
          )}

          {form.rail === "WIRE_DOM" && (
            <div className="form-grid">
              <div className="input-group">
                <label className="input-label" htmlFor="wire_routing">
                  Wire Routing Number
                </label>
                <input id="wire_routing" type="text" name="wire_routing" value={form.wire_routing} onChange={onChange} className="input-control" required />
              </div>
              <SensitiveInput name="wire_account" label="Wire Account Number" placeholder="Account number" value={form.wire_account} onChange={onChange} />
              <div className="input-group">
                <label className="input-label" htmlFor="bank_address">
                  Bank Address
                </label>
                <input id="bank_address" type="text" name="bank_address" value={form.bank_address} onChange={onChange} className="input-control" placeholder={form.address} />
              </div>
            </div>
          )}

          {form.rail === "SWIFT" && (
            <div className="form-grid">
              <div className="input-group">
                <label className="input-label" htmlFor="swift_bic">
                  SWIFT/BIC
                </label>
                <input id="swift_bic" type="text" name="swift_bic" value={form.swift_bic} onChange={onChange} className="input-control" required />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="iban">
                  IBAN
                </label>
                <input id="iban" type="text" name="iban" value={form.iban} onChange={onChange} className="input-control" required />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="bank_country">
                  Bank Country
                </label>
                <input id="bank_country" type="text" name="bank_country" value={form.bank_country} onChange={onChange} className="input-control" required />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="bank_city">
                  Bank City
                </label>
                <input id="bank_city" type="text" name="bank_city" value={form.bank_city} onChange={onChange} className="input-control" />
              </div>
            </div>
          )}
        </>
      )}

      <button type="submit" className="button" disabled={loading}>
        {loading && <span className="spinner" aria-hidden="true" />}
        Generate UPI
      </button>
    </form>
  );
}
