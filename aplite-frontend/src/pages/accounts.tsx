import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createAccount, listAccounts } from "../utils/api";
import { useAuth } from "../utils/auth";

type Rail = "ACH" | "WIRE_DOM" | "SWIFT";

const defaultAccount = {
  rail: "ACH" as Rail,
  bank_name: "",
  account_name: "",
  ach_routing: "",
  ach_account: "",
  wire_routing: "",
  wire_account: "",
  bank_address: "",
  swift_bic: "",
  iban: "",
  bank_country: "",
  bank_city: "",
};

export default function AccountsPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({ ...defaultAccount });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    void loadAccounts();
  }, [ready, token]);

  async function loadAccounts() {
    try {
      const res = await listAccounts();
      setAccounts(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load accounts");
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await createAccount({
        rail: form.rail,
        bank_name: form.bank_name,
        account_name: form.account_name,
        ach_routing: form.rail === "ACH" ? form.ach_routing : undefined,
        ach_account: form.rail === "ACH" ? form.ach_account : undefined,
        wire_routing: form.rail === "WIRE_DOM" ? form.wire_routing : undefined,
        wire_account: form.rail === "WIRE_DOM" ? form.wire_account : undefined,
        bank_address: form.bank_address,
        swift_bic: form.rail === "SWIFT" ? form.swift_bic : undefined,
        iban: form.rail === "SWIFT" ? form.iban : undefined,
        bank_country: form.rail === "SWIFT" ? form.bank_country : undefined,
        bank_city: form.rail === "SWIFT" ? form.bank_city : undefined,
      });
      setSuccess("Account saved");
      setForm({ ...defaultAccount });
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save account");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return null;
  }

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Accounts</p>
          <h1 className="hero-title">Manage payout rails</h1>
          <p className="hero-subtitle">Create reusable accounts for ACH, wire, or SWIFT to mint new UPIs faster.</p>
        </div>
      </section>

      {error && (
        <div className="error-box" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
      {success && (
        <div className="status-pill" role="status" aria-live="polite">
          {success}
        </div>
      )}

      <form className="card form-card" onSubmit={handleSubmit}>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div className="input-group">
            <label className="input-label" htmlFor="rail">
              Rail
            </label>
            <select id="rail" name="rail" value={form.rail} onChange={handleChange} className="input-control">
              <option value="ACH">ACH</option>
              <option value="WIRE_DOM">WIRE_DOM</option>
              <option value="SWIFT">SWIFT</option>
            </select>
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="bank_name">
              Bank Name
            </label>
            <input id="bank_name" name="bank_name" value={form.bank_name} onChange={handleChange} className="input-control" required />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="account_name">
              Account Name
            </label>
            <input id="account_name" name="account_name" value={form.account_name} onChange={handleChange} className="input-control" />
          </div>
        </div>

        {form.rail === "ACH" && (
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label" htmlFor="ach_routing">
                ACH Routing
              </label>
              <input id="ach_routing" name="ach_routing" value={form.ach_routing} onChange={handleChange} className="input-control" required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="ach_account">
                ACH Account
              </label>
              <input id="ach_account" name="ach_account" value={form.ach_account} onChange={handleChange} className="input-control" required />
            </div>
          </div>
        )}

        {form.rail === "WIRE_DOM" && (
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label" htmlFor="wire_routing">
                Wire Routing
              </label>
              <input id="wire_routing" name="wire_routing" value={form.wire_routing} onChange={handleChange} className="input-control" required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="wire_account">
                Wire Account
              </label>
              <input id="wire_account" name="wire_account" value={form.wire_account} onChange={handleChange} className="input-control" required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="bank_address">
                Bank Address
              </label>
              <input id="bank_address" name="bank_address" value={form.bank_address} onChange={handleChange} className="input-control" />
            </div>
          </div>
        )}

        {form.rail === "SWIFT" && (
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label" htmlFor="swift_bic">
                SWIFT/BIC
              </label>
              <input id="swift_bic" name="swift_bic" value={form.swift_bic} onChange={handleChange} className="input-control" required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="iban">
                IBAN
              </label>
              <input id="iban" name="iban" value={form.iban} onChange={handleChange} className="input-control" required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="bank_country">
                Bank Country
              </label>
              <input id="bank_country" name="bank_country" value={form.bank_country} onChange={handleChange} className="input-control" required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="bank_city">
                Bank City
              </label>
              <input id="bank_city" name="bank_city" value={form.bank_city} onChange={handleChange} className="input-control" />
            </div>
          </div>
        )}

        <button className="button" type="submit" disabled={loading}>
          {loading && <span className="spinner" aria-hidden="true" />}
          Save Account
        </button>
      </form>

      <div className="card" style={{ marginTop: 20 }}>
        <p className="section-title">Saved Accounts</p>
        <div className="table">
          <div className="table-head">
            <span>ID</span>
            <span>Rail</span>
            <span>Bank</span>
            <span>Name</span>
            <span>Index</span>
          </div>
          {accounts.map((acct) => (
            <div key={acct.id} className="table-row">
              <span>{acct.id}</span>
              <span>{acct.rail}</span>
              <span>{acct.bank_name}</span>
              <span>{acct.account_name}</span>
              <span>{acct.payment_index}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
