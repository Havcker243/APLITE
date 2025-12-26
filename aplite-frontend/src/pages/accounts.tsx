import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createAccount, listAccounts, updateAccount } from "../utils/api";
import { useAuth } from "../utils/auth";
import { requireVerifiedOrRedirect } from "../utils/requireVerified";

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
  const { token, loading, profile } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({ ...defaultAccount });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...defaultAccount });
  const [editRailLocked, setEditRailLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);


  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    requireVerifiedOrRedirect({ profile, router });
    void loadAccounts();
  }, [mounted, loading, token, profile, router]);

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

  function handleEditChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
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
      setSaving(false);
    }
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId) return;
    setEditSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateAccount(editId, {
        bank_name: editForm.bank_name,
        account_name: editForm.account_name,
        ach_routing: editRailLocked ? undefined : editForm.ach_routing,
        ach_account: editRailLocked ? undefined : editForm.ach_account,
        wire_routing: editRailLocked ? undefined : editForm.wire_routing,
        wire_account: editRailLocked ? undefined : editForm.wire_account,
        bank_address: editRailLocked ? undefined : editForm.bank_address,
        swift_bic: editRailLocked ? undefined : editForm.swift_bic,
        iban: editRailLocked ? undefined : editForm.iban,
        bank_country: editRailLocked ? undefined : editForm.bank_country,
        bank_city: editRailLocked ? undefined : editForm.bank_city,
      });
      setSuccess("Account updated");
      setEditId(null);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update account");
    } finally {
      setEditSaving(false);
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
        <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
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

        <button className="button" type="submit" disabled={saving}>
          {saving && <span className="spinner" aria-hidden="true" />}
          Save Account
        </button>
      </form>

      {editId && (
        <form className="card form-card" onSubmit={handleEditSubmit} style={{ marginTop: 18 }}>
          <div className="meta-row" style={{ marginBottom: 10 }}>
            <div>
              <p className="section-title">Edit Account</p>
              {editRailLocked && (
                <p className="hero-subtitle" style={{ marginTop: 6 }}>
                  Rail fields are locked once an account is used by a UPI. Create a new account to change rail details.
                </p>
              )}
            </div>
            <button type="button" className="button button-secondary" onClick={() => setEditId(null)}>
              Cancel
            </button>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="input-group">
              <label className="input-label" htmlFor="edit-rail">
                Rail
              </label>
              <select id="edit-rail" name="rail" value={editForm.rail} onChange={handleEditChange} className="input-control" disabled>
                <option value="ACH">ACH</option>
                <option value="WIRE_DOM">WIRE_DOM</option>
                <option value="SWIFT">SWIFT</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="edit-bank_name">
                Bank Name
              </label>
              <input id="edit-bank_name" name="bank_name" value={editForm.bank_name} onChange={handleEditChange} className="input-control" required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="edit-account_name">
                Account Name
              </label>
              <input id="edit-account_name" name="account_name" value={editForm.account_name} onChange={handleEditChange} className="input-control" />
            </div>
          </div>

          {editForm.rail === "ACH" && (
            <div className="form-grid">
              <div className="input-group">
                <label className="input-label" htmlFor="edit-ach_routing">
                  ACH Routing
                </label>
                <input
                  id="edit-ach_routing"
                  name="ach_routing"
                  value={editForm.ach_routing}
                  onChange={handleEditChange}
                  className="input-control"
                  required={!editRailLocked}
                  disabled={editRailLocked}
                  style={editRailLocked ? { opacity: 0.6 } : undefined}
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="edit-ach_account">
                  ACH Account
                </label>
                <input
                  id="edit-ach_account"
                  name="ach_account"
                  value={editForm.ach_account}
                  onChange={handleEditChange}
                  className="input-control"
                  required={!editRailLocked}
                  disabled={editRailLocked}
                  style={editRailLocked ? { opacity: 0.6 } : undefined}
                />
              </div>
            </div>
          )}

          {editForm.rail === "WIRE_DOM" && (
            <div className="form-grid">
              <div className="input-group">
                <label className="input-label" htmlFor="edit-wire_routing">
                  Wire Routing
                </label>
                <input
                  id="edit-wire_routing"
                  name="wire_routing"
                  value={editForm.wire_routing}
                  onChange={handleEditChange}
                  className="input-control"
                  required={!editRailLocked}
                  disabled={editRailLocked}
                  style={editRailLocked ? { opacity: 0.6 } : undefined}
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="edit-wire_account">
                  Wire Account
                </label>
                <input
                  id="edit-wire_account"
                  name="wire_account"
                  value={editForm.wire_account}
                  onChange={handleEditChange}
                  className="input-control"
                  required={!editRailLocked}
                  disabled={editRailLocked}
                  style={editRailLocked ? { opacity: 0.6 } : undefined}
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="edit-bank_address">
                  Bank Address
                </label>
                <input
                  id="edit-bank_address"
                  name="bank_address"
                  value={editForm.bank_address}
                  onChange={handleEditChange}
                  className="input-control"
                  disabled={editRailLocked}
                  style={editRailLocked ? { opacity: 0.6 } : undefined}
                />
              </div>
            </div>
          )}

          {editForm.rail === "SWIFT" && (
            <div className="form-grid">
              <div className="input-group">
                <label className="input-label" htmlFor="edit-swift_bic">
                  SWIFT/BIC
                </label>
                <input
                  id="edit-swift_bic"
                  name="swift_bic"
                  value={editForm.swift_bic}
                  onChange={handleEditChange}
                  className="input-control"
                  required={!editRailLocked}
                  disabled={editRailLocked}
                  style={editRailLocked ? { opacity: 0.6 } : undefined}
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="edit-iban">
                  IBAN
                </label>
                <input
                  id="edit-iban"
                  name="iban"
                  value={editForm.iban}
                  onChange={handleEditChange}
                  className="input-control"
                  required={!editRailLocked}
                  disabled={editRailLocked}
                  style={editRailLocked ? { opacity: 0.6 } : undefined}
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="edit-bank_country">
                  Bank Country
                </label>
                <input
                  id="edit-bank_country"
                  name="bank_country"
                  value={editForm.bank_country}
                  onChange={handleEditChange}
                  className="input-control"
                  required={!editRailLocked}
                  disabled={editRailLocked}
                  style={editRailLocked ? { opacity: 0.6 } : undefined}
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="edit-bank_city">
                  Bank City
                </label>
                <input
                  id="edit-bank_city"
                  name="bank_city"
                  value={editForm.bank_city}
                  onChange={handleEditChange}
                  className="input-control"
                  disabled={editRailLocked}
                  style={editRailLocked ? { opacity: 0.6 } : undefined}
                />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
            <button className="button" type="submit" disabled={editSaving}>
              {editSaving && <span className="spinner" aria-hidden="true" />}
              Save Changes
            </button>
            {editRailLocked && (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setEditId(null);
                  setForm({ ...defaultAccount });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Create new account
              </button>
            )}
          </div>
        </form>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <p className="section-title">Saved Accounts</p>
        {accounts.length === 0 ? (
          <p className="hero-subtitle">No saved accounts yet.</p>
        ) : (
          <div className="table">
            <div className="table-head">
              <span>#</span>
              <span>Rail</span>
              <span>Bank</span>
              <span>Name</span>
              <span>Actions</span>
            </div>
            {accounts.map((acct, index) => (
              <div key={acct.id} className="table-row">
                <span>{index + 1}</span>
                <span>{acct.rail}</span>
                <span>{acct.bank_name}</span>
                <span>{acct.account_name}</span>
                <span>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                      setEditId(acct.id);
                      setEditForm({
                        rail: acct.rail,
                        bank_name: acct.bank_name || "",
                        account_name: acct.account_name || "",
                        ach_routing: acct.ach_routing || "",
                        ach_account: acct.ach_account || "",
                        wire_routing: acct.wire_routing || "",
                        wire_account: acct.wire_account || "",
                        bank_address: acct.bank_address || "",
                        swift_bic: acct.swift_bic || "",
                        iban: acct.iban || "",
                        bank_country: acct.bank_country || "",
                        bank_city: acct.bank_city || "",
                      });
                      setEditRailLocked(Boolean(acct.rail_locked));
                    }}
                  >
                    Edit
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
