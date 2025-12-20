import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";
import { ResolveForm } from "../components/ResolveForm";
import { ResolutionResult } from "../components/ResolutionResult";
import { ResultCard } from "../components/ResultCard";
import { LoadingScreen } from "../components/LoadingScreen";

import {
  listAccounts,
  resolveUPI,
  fetchProfileDetails,
  createChildUpi,
  listChildUpis,
} from "../utils/api";
import { useAuth } from "../utils/auth";
import { requireVerifiedOrRedirect } from "../utils/requireVerified";

// legacy field labels removed

const UPI_PATTERN = /^[A-Z0-9]{14}$/;
type ChildUpiForm = {
  name: string;
  type: string;
  website: string;
  account_mode: "existing" | "new";
  payment_account_id: string;
  rail: "ACH" | "WIRE_DOM" | "SWIFT";
  bank_name: string;
  account_name: string;
  ach_routing: string;
  ach_account: string;
  wire_routing: string;
  wire_account: string;
  swift_bic: string;
  iban: string;
  bank_country: string;
  bank_city: string;
  bank_address: string;
};

const ROUTING_PATTERN = /^\d{9}$/;

const defaultForm: ChildUpiForm = {
  name: "",
  type: "",
  website: "",
  account_mode: "existing",
  payment_account_id: "",
  rail: "ACH",
  bank_name: "",
  account_name: "",
  ach_routing: "",
  ach_account: "",
  wire_routing: "",
  wire_account: "",
  swift_bic: "",
  iban: "",
  bank_country: "",
  bank_city: "",
  bank_address: "",
};

function validateChildForm(data: ChildUpiForm): string[] {
  const errors: string[] = [];
  if (!data.name.trim()) errors.push("Name is required");
  if (!data.type.trim()) errors.push("Type is required");

  if (data.account_mode === "existing") {
    if (!data.payment_account_id) errors.push("Select an existing payment account");
  } else {
    if (!data.bank_name.trim()) errors.push("Bank name is required");
    if (data.rail === "ACH") {
      if (!ROUTING_PATTERN.test(data.ach_routing)) errors.push("ACH routing must be 9 digits");
      if (!data.ach_account.trim()) errors.push("ACH account is required");
    }
    if (data.rail === "WIRE_DOM") {
      if (!data.wire_routing || data.wire_routing.length < 6) errors.push("Wire routing should be at least 6 digits");
      if (!data.wire_account.trim()) errors.push("Wire account is required");
    }
    if (data.rail === "SWIFT") {
      if (!data.swift_bic.trim()) errors.push("SWIFT/BIC is required");
      if (!data.iban.trim()) errors.push("IBAN is required");
      if (!data.bank_country.trim()) errors.push("Bank country is required");
    }
  }
  return errors;
}

function maskUpi(upi: string) {
  if (!upi) return "";
  return `${upi.slice(0, 3)}${"*".repeat(Math.max(upi.length - 3, 0))}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, ready, accessLevel, profileReady } = useAuth();

  const [form, setForm] = useState<ChildUpiForm>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [upi, setUpi] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [childUpis, setChildUpis] = useState<
    Array<{ upi: string; payment_account_id: number; rail: string; bank_name?: string; created_at?: string }>
  >([]);
  const [childUpisError, setChildUpisError] = useState<string | null>(null);

  const [resolveUpi, setResolveUpi] = useState("");
  const [resolveRail, setResolveRail] = useState<"ACH" | "WIRE_DOM" | "SWIFT">(
    "ACH"
  );
  const [resolveResult, setResolveResult] = useState<any>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!mounted || !ready || !profileReady) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (accessLevel === "ONBOARDING") {
      router.replace("/onboard");
      return;
    }
    requireVerifiedOrRedirect({ token, router });
    loadOrg();
    loadAccounts();
    loadChildUpis();
  }, [mounted, ready, profileReady, token, accessLevel, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadOrg() {
    try {
      const details = await fetchProfileDetails();
      const org = details.organization;
      setOrgName(org?.legal_name || "");
      const orgUpi = org?.upi || org?.issued_upi || null;
      setUpi(orgUpi);
    } catch {
      setOrgName("");
      setUpi(null);
    }
  }

  async function loadAccounts() {
    try {
      const res = await listAccounts();
      setAccounts(res);
      setAccountsError(null);
    } catch (err) {
      setAccountsError(
        err instanceof Error ? err.message : "Unable to load accounts"
      );
    }
  }

  async function loadChildUpis() {
    try {
      const res = await listChildUpis();
      setChildUpis(res);
      setChildUpisError(null);
    } catch (err) {
      setChildUpisError(err instanceof Error ? err.message : "Unable to load child UPIs");
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setUpi(null);

    const errors = validateChildForm(form);
    if (errors.length) {
      setValidationErrors(errors);
      setLoading(false);
      return;
    }
    setValidationErrors([]);

    try {
      const payload: any = {
        name: form.name,
        type: form.type,
      };
      if (form.website.trim()) payload.website = form.website.trim();
      if (form.account_mode === "existing" && form.payment_account_id) {
        payload.account_id = Number(form.payment_account_id);
      } else {
        payload.account = {
          rail: form.rail,
          bank_name: form.bank_name,
          account_name: form.account_name || form.name,
          ach_routing: form.ach_routing || undefined,
          ach_account: form.ach_account || undefined,
          wire_routing: form.wire_routing || undefined,
          wire_account: form.wire_account || undefined,
          bank_address: form.bank_address || undefined,
          swift_bic: form.swift_bic || undefined,
          iban: form.iban || undefined,
          bank_country: form.bank_country || undefined,
          bank_city: form.bank_city || undefined,
        };
      }

      const response = await createChildUpi(payload);
      setUpi(response.upi);
      await loadOrg();
      await loadChildUpis();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create business"
      );
      setUpi(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResolveError(null);
    setResolveResult(null);
    setResolving(true);

    if (!UPI_PATTERN.test(resolveUpi.trim())) {
      setResolveError("UPI must be exactly 14 alphanumeric characters");
      setResolving(false);
      return;
    }

    try {
      const response = await resolveUPI({
        upi: resolveUpi.trim(),
        rail: resolveRail,
      });
      setResolveResult(response);
    } catch (err) {
      setResolveError(
        err instanceof Error ? err.message : "Unable to resolve UPI"
      );
    } finally {
      setResolving(false);
    }
  }

  const maskedMasterUpi = useMemo(() => maskUpi(user?.master_upi ?? ""), [user]);

  if (!ready || !token || !mounted) {
    return <LoadingScreen />;
  }

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Your workspace</p>
          <h1 className="hero-title">UPI management</h1>
          <p className="hero-subtitle">
            Create identifiers, attach payout rails, resolve details, and copy
            coordinates securely.
          </p>
        </div>
      </section>

      {/* Master UPI is internal; not shown to avoid sharing the root identifier. */}

      {validationErrors.length > 0 && (
        <div className="error-box" role="alert" aria-live="assertive">
          <strong>Please fix the following:</strong>
          <ul>
            {validationErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="error-box" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
      {accountsError && (
        <div className="error-box" role="alert" aria-live="assertive">
          {accountsError}
        </div>
      )}

      <div className="card-grid" style={{ alignItems: "flex-start" }}>
        <form className="card form-card" onSubmit={handleSubmit}>
          <h3 style={{ marginTop: 0 }}>Issue a child UPI</h3>
          <p className="hero-subtitle">Create a UPI tied to an existing or new payout account.</p>

          <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 10 }}>
            <div className="input-group">
              <label className="input-label" htmlFor="name">
                Name
              </label>
              <input id="name" name="name" className="input-control" value={form.name} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="type">
                Type
              </label>
              <input id="type" name="type" className="input-control" value={form.type} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="website">
                Website (optional)
              </label>
              <input id="website" name="website" className="input-control" value={form.website} onChange={handleChange} />
            </div>

            <div className="input-group">
              <label className="input-label">Payment account</label>
              <select
                name="account_mode"
                className="input-control"
                value={form.account_mode}
                onChange={(e) => setForm((p) => ({ ...p, account_mode: e.target.value as any }))}
              >
                <option value="existing">Use existing</option>
                <option value="new">Add new</option>
              </select>
            </div>

            {form.account_mode === "existing" ? (
              <div className="input-group">
                <label className="input-label" htmlFor="payment_account_id">
                  Choose account
                </label>
                <select
                  id="payment_account_id"
                  name="payment_account_id"
                  className="input-control"
                  value={form.payment_account_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select...</option>
                  {accounts.map((acct: any) => (
                    <option key={acct.id} value={acct.id}>
                      {acct.bank_name || "Account"} ({acct.rail})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="input-group">
                  <label className="input-label" htmlFor="rail">
                    Rail
                  </label>
                  <select id="rail" name="rail" className="input-control" value={form.rail} onChange={handleChange}>
                    <option value="ACH">ACH</option>
                    <option value="WIRE_DOM">Wire</option>
                    <option value="SWIFT">SWIFT</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="bank_name">
                    Bank name
                  </label>
                  <input id="bank_name" name="bank_name" className="input-control" value={form.bank_name} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="account_name">
                    Account name
                  </label>
                  <input id="account_name" name="account_name" className="input-control" value={form.account_name} onChange={handleChange} />
                </div>
                {form.rail === "ACH" && (
                  <>
                    <div className="input-group">
                      <label className="input-label" htmlFor="ach_routing">
                        ACH routing
                      </label>
                      <input id="ach_routing" name="ach_routing" className="input-control" value={form.ach_routing} onChange={handleChange} />
                    </div>
                    <div className="input-group">
                      <label className="input-label" htmlFor="ach_account">
                        ACH account
                      </label>
                      <input id="ach_account" name="ach_account" className="input-control" value={form.ach_account} onChange={handleChange} />
                    </div>
                  </>
                )}
                {form.rail === "WIRE_DOM" && (
                  <>
                    <div className="input-group">
                      <label className="input-label" htmlFor="wire_routing">
                        Wire routing
                      </label>
                      <input id="wire_routing" name="wire_routing" className="input-control" value={form.wire_routing} onChange={handleChange} />
                    </div>
                    <div className="input-group">
                      <label className="input-label" htmlFor="wire_account">
                        Wire account
                      </label>
                      <input id="wire_account" name="wire_account" className="input-control" value={form.wire_account} onChange={handleChange} />
                    </div>
                  </>
                )}
                {form.rail === "SWIFT" && (
                  <>
                    <div className="input-group">
                      <label className="input-label" htmlFor="swift_bic">
                        SWIFT/BIC
                      </label>
                      <input id="swift_bic" name="swift_bic" className="input-control" value={form.swift_bic} onChange={handleChange} />
                    </div>
                    <div className="input-group">
                      <label className="input-label" htmlFor="iban">
                        IBAN
                      </label>
                      <input id="iban" name="iban" className="input-control" value={form.iban} onChange={handleChange} />
                    </div>
                    <div className="input-group">
                      <label className="input-label" htmlFor="bank_country">
                        Bank country
                      </label>
                      <input id="bank_country" name="bank_country" className="input-control" value={form.bank_country} onChange={handleChange} />
                    </div>
                  </>
                )}
                <div className="input-group">
                  <label className="input-label" htmlFor="bank_address">
                    Bank address (optional)
                  </label>
                  <textarea id="bank_address" name="bank_address" className="input-control" value={form.bank_address} onChange={handleChange} />
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 18 }}>
            <button className="button" type="submit" disabled={loading}>
              {loading && <span className="spinner" aria-hidden="true" />}
              Create child UPI
            </button>
          </div>
          </form>

        <div className="stacked-panels">

          <div className="card">
            <p className="section-title">Child UPIs</p>
            <p className="hero-subtitle">Issued identifiers tied to your payment accounts.</p>
            {childUpisError && <div className="error-box">{childUpisError}</div>}
          {childUpis.length === 0 ? (
            <p className="hero-subtitle">No child UPIs yet.</p>
          ) : (
            <div className="list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {childUpis.map((c) => (
                <div key={`${c.payment_account_id}-${c.upi}`} className="card" style={{ padding: 12 }}>
                    <p className="section-title" style={{ marginBottom: 4 }}>
                      {c.bank_name || "Account"} · {c.rail}
                    </p>
                    <div className="hero-subtitle" style={{ wordBreak: "break-all" }}>
                      {c.upi || "(pending)"}
                    </div>
                    {c.created_at && (
                      <p className="hero-subtitle" style={{ marginTop: 4 }}>
                        Created: {new Date(c.created_at).toLocaleString()}
                      </p>
                    )}
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => {
                        if (!c.upi) return;
                        navigator.clipboard?.writeText(c.upi).catch(() => undefined);
                        const toast = document.createElement("div");
                        toast.textContent = "Copied";
                        toast.style.position = "fixed";
                        toast.style.bottom = "32px";
                        toast.style.left = "50%";
                        toast.style.transform = "translateX(-50%)";
                        toast.style.padding = "12px 16px";
                        toast.style.background = "#1e88e5";
                        toast.style.color = "#fff";
                        toast.style.borderRadius = "10px";
                        toast.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";
                        toast.style.fontWeight = "600";
                        toast.style.zIndex = "9999";
                        document.body.appendChild(toast);
                        setTimeout(() => toast.remove(), 1500);
                      }}
                      disabled={!c.upi}
                    >
                      Copy UPI
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {orgName && upi && (
            <div className="card">
              <p className="section-title">
                Org UPI{" "}
                <span
                  title="Use this org-level UPI with partners/vendors. Master UPI stays private."
                  aria-label="Org UPI info"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.6)",
                    fontSize: 12,
                    fontWeight: 700,
                    marginLeft: 6,
                    cursor: "help",
                  }}
                >
                  i
                </span>
              </p>
              <h3 style={{ marginTop: 0 }}>{upi}</h3>
              <p className="hero-subtitle" style={{ marginTop: 4 }}>
                Issued for {orgName}. Share this instead of your Master UPI.
              </p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(upi).catch(() => undefined);
                  const toast = document.createElement("div");
                  toast.textContent = "Copied";
                  toast.style.position = "fixed";
                  toast.style.bottom = "32px";
                  toast.style.left = "50%";
                  toast.style.transform = "translateX(-50%)";
                  toast.style.padding = "12px 16px";
                  toast.style.background = "#1e88e5";
                  toast.style.color = "#fff";
                  toast.style.borderRadius = "10px";
                  toast.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";
                  toast.style.fontWeight = "600";
                  toast.style.zIndex = "9999";
                document.body.appendChild(toast);
                setTimeout(() => {
                  toast.remove();
                }, 1500);
                }}
              >
                Copy Org UPI
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="hero" style={{ marginTop: 30 }}>
        <div>
          <p className="section-title">Resolve an identifier</p>
          <p className="hero-subtitle">
            Validate a UPI created in this workspace and return its payout
            coordinates.
          </p>
        </div>
      </section>

      {resolveError && <div className="error-box">{resolveError}</div>}

      <ResolveForm
        upi={resolveUpi}
        rail={resolveRail}
        loading={resolving}
        onUpiChange={setResolveUpi}
        onRailChange={setResolveRail}
        onSubmit={handleResolve}
      />

      {resolveResult && <ResolutionResult result={resolveResult} />}
    </div>
  );
}
