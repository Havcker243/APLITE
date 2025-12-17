import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";
import { BusinessForm, BusinessFormData } from "../components/BusinessForm";
import { HistoryPanel } from "../components/HistoryPanel";
import { ResolveForm } from "../components/ResolveForm";
import { ResolutionResult } from "../components/ResolutionResult";
import { ResultCard } from "../components/ResultCard";
import { BusinessSummary, deactivateBusiness, fetchBusinesses, listAccounts, onboardBusiness, resolveUPI } from "../utils/api";
import { useAuth } from "../utils/auth";

const FIELD_LABELS: Partial<Record<keyof BusinessFormData, string>> = {
  legal_name: "Legal Name",
  ein: "EIN",
  business_type: "Business Type",
  website: "Website",
  address: "Address",
  country: "Country",
  account_mode: "Account Mode",
  payment_account_id: "Saved Account",
  rail: "Rail",
  bank_name: "Bank Name",
  account_name: "Account Name",
  ach_routing: "ACH Routing",
  ach_account: "ACH Account",
  wire_routing: "Wire Routing",
  wire_account: "Wire Account",
  bank_address: "Bank Address",
  swift_bic: "SWIFT/BIC",
  iban: "IBAN",
  bank_country: "Bank Country",
  bank_city: "Bank City",
};

const requiredFields: Array<keyof BusinessFormData> = [
  "legal_name",
  "ein",
  "business_type",
  "address",
  "country",
];

const EIN_PATTERN = /^\d{2}-\d{7}$/;
const ROUTING_PATTERN = /^\d{9}$/;
const UPI_PATTERN = /^[A-Z0-9]{14}$/;

const defaultForm: BusinessFormData = {
  legal_name: "",
  ein: "",
  business_type: "",
  website: "",
  address: "",
  country: "US",
  account_mode: "new",
  payment_account_id: "",
  rail: "ACH",
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

function validateForm(data: BusinessFormData): string[] {
  const errors: string[] = [];

  requiredFields.forEach((field) => {
    if (!data[field] || !data[field].trim()) {
      const label = FIELD_LABELS[field] || String(field);
      errors.push(`${label} is required`);
    }
  });

  if (data.ein && !EIN_PATTERN.test(data.ein)) {
    errors.push("EIN must match NN-NNNNNNN format");
  }

  if (data.account_mode === "new") {
    if (!data.bank_name) {
      errors.push("Bank Name is required");
    }
    if (data.rail === "ACH") {
      if (!ROUTING_PATTERN.test(data.ach_routing)) {
        errors.push("ACH routing number must be 9 digits");
      }
      if (!data.ach_account) {
        errors.push("ACH account number is required");
      }
    }
    if (data.rail === "WIRE_DOM") {
      if (!data.wire_routing || data.wire_routing.length < 6) {
        errors.push("Wire routing should be at least 6 characters");
      }
      if (!data.wire_account) {
        errors.push("Wire account number is required");
      }
    }
    if (data.rail === "SWIFT") {
      if (!data.swift_bic) errors.push("SWIFT/BIC is required");
      if (!data.iban) errors.push("IBAN is required");
      if (!data.bank_country) errors.push("Bank country is required");
    }
  } else {
    if (!data.payment_account_id) {
      errors.push("Please select a saved account");
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
  const { user, token, ready } = useAuth();

  const [form, setForm] = useState<BusinessFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [upi, setUpi] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [history, setHistory] = useState<BusinessSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [resolveUpi, setResolveUpi] = useState("");
  const [resolveRail, setResolveRail] = useState<"ACH" | "WIRE_DOM" | "SWIFT">("ACH");
  const [resolveResult, setResolveResult] = useState<any>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [deactivating, setDeactivating] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    void loadHistory();
    void loadAccounts();
  }, [ready, token]);

  async function loadHistory() {
    try {
      const records = await fetchBusinesses(8);
      setHistory(records);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Unable to load history");
    }
  }

  async function handleDeactivate(id: number) {
    if (!window.confirm("Deactivate this UPI? This will block resolves.")) return;
    setDeactivating(id);
    try {
      await deactivateBusiness(id);
      await loadHistory();
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Unable to deactivate");
    } finally {
      setDeactivating(null);
    }
  }

  async function loadAccounts() {
    try {
      const res = await listAccounts();
      setAccounts(res);
      setAccountsError(null);
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : "Unable to load accounts");
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
    setUpi(null);

    const errors = validateForm(form);
    if (errors.length) {
      setValidationErrors(errors);
      setLoading(false);
      return;
    }
    setValidationErrors([]);

    try {
      const payload =
        form.account_mode === "existing"
          ? {
              legal_name: form.legal_name,
              ein: form.ein,
              business_type: form.business_type,
              website: form.website,
              address: form.address,
              country: form.country,
              payment_account_id: Number(form.payment_account_id),
            }
          : {
              legal_name: form.legal_name,
              ein: form.ein,
              business_type: form.business_type,
              website: form.website,
              address: form.address,
              country: form.country,
              account: {
                rail: form.rail,
                bank_name: form.bank_name,
                account_name: form.account_name || form.legal_name,
                ach_routing: form.ach_routing,
                ach_account: form.ach_account,
                wire_routing: form.wire_routing,
                wire_account: form.wire_account,
                bank_address: form.bank_address || form.address,
                swift_bic: form.swift_bic,
                iban: form.iban,
                bank_country: form.bank_country || form.country,
                bank_city: form.bank_city,
              },
            };

      const response = await onboardBusiness(payload as any);
      setUpi(response.upi);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create business");
      setUpi(null);
    } finally {
      setLoading(false);
    }
  }

  function handleHistoryCopy(upiCode: string) {
    navigator.clipboard?.writeText(upiCode).catch(() => undefined);
    setCopyNotice("Copied");
    setTimeout(() => setCopyNotice(null), 2000);
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
      const response = await resolveUPI({ upi: resolveUpi.trim(), rail: resolveRail });
      setResolveResult(response);
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Unable to resolve UPI");
    } finally {
      setResolving(false);
    }
  }

  const maskedMasterUpi = useMemo(() => maskUpi(user?.master_upi ?? ""), [user]);

  if (!token) {
    return null;
  }

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Your workspace</p>
          <h1 className="hero-title">UPI management</h1>
          <p className="hero-subtitle">Create identifiers, attach payout rails, resolve details, and copy coordinates securely.</p>
        </div>
      </section>

      <div className="card-grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <p className="section-title">Master UPI</p>
          <h2 style={{ marginTop: 0 }}>{maskedMasterUpi}</h2>
          <p className="hero-subtitle">This is the parent identifier for your workspace.</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => navigator.clipboard?.writeText(user?.master_upi ?? "")}
            disabled={!user?.master_upi}
          >
            Copy Master UPI
          </button>
        </div>
        <div className="card">
          <p className="section-title">Need another user?</p>
          <h2 style={{ marginTop: 0 }}>Invite teammates securely</h2>
          <p className="hero-subtitle">Contact our team to enable multi-user access with proper controls.</p>
          <Link href="/" className="button button-secondary">
            Get Help
          </Link>
        </div>
      </div>

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
        <BusinessForm form={form} accounts={accounts} loading={loading} onChange={handleChange} onSubmit={handleSubmit} />

        <div className="stacked-panels">
          {upi && <ResultCard upi={upi} />}
          {copyNotice && (
            <div className="status-pill" role="status" aria-live="polite">
              {copyNotice}
            </div>
          )}
          {historyError && (
            <div className="error-box" role="alert" aria-live="assertive">
              {historyError}
            </div>
          )}
          <HistoryPanel entries={history} onCopy={handleHistoryCopy} onDeactivate={handleDeactivate} deactivatingId={deactivating} />
        </div>
      </div>

      <section className="hero" style={{ marginTop: 30 }}>
        <div>
          <p className="section-title">Resolve an identifier</p>
          <p className="hero-subtitle">Validate a UPI created in this workspace and return its payout coordinates.</p>
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
