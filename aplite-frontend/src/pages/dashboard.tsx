import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";
import { BusinessForm, BusinessFormData } from "../components/BusinessForm";
import { HistoryPanel } from "../components/HistoryPanel";
import { ResolveForm } from "../components/ResolveForm";
import { ResolutionResult } from "../components/ResolutionResult";
import { ResultCard } from "../components/ResultCard";
import { BusinessSummary, fetchBusinesses, onboardBusiness, resolveUPI } from "../utils/api";
import { useAuth } from "../utils/auth";

const FIELD_LABELS: Record<keyof BusinessFormData, string> = {
  legal_name: "Legal Name",
  ein: "EIN",
  business_type: "Business Type",
  website: "Website",
  address: "Address",
  country: "Country",
  bank_name: "Bank Name",
  ach_routing: "ACH Routing",
  ach_account: "ACH Account",
  wire_routing: "Wire Routing",
  wire_account: "Wire Account",
};

const requiredFields: Array<keyof BusinessFormData> = [
  "legal_name",
  "ein",
  "business_type",
  "address",
  "country",
  "bank_name",
  "ach_routing",
  "ach_account",
  "wire_routing",
  "wire_account",
];

const EIN_PATTERN = /^\d{2}-\d{7}$/;
const ROUTING_PATTERN = /^\d{9}$/;
const UPI_PATTERN = /^[A-Z0-9]{8}$/;

const defaultForm: BusinessFormData = {
  legal_name: "",
  ein: "",
  business_type: "",
  website: "",
  address: "",
  country: "US",
  bank_name: "",
  ach_routing: "",
  ach_account: "",
  wire_routing: "",
  wire_account: "",
};

function validateForm(data: BusinessFormData): string[] {
  const errors: string[] = [];

  requiredFields.forEach((field) => {
    if (!data[field] || !data[field].trim()) {
      errors.push(`${FIELD_LABELS[field]} is required`);
    }
  });

  if (data.ein && !EIN_PATTERN.test(data.ein)) {
    errors.push("EIN must match NN-NNNNNNN format");
  }

  if (data.ach_routing && !ROUTING_PATTERN.test(data.ach_routing)) {
    errors.push("ACH routing number must be 9 digits");
  }

  if (data.wire_routing && data.wire_routing.length < 6) {
    errors.push("Wire routing should be at least 6 characters");
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

  const [resolveUpi, setResolveUpi] = useState("");
  const [resolveRail, setResolveRail] = useState<"ACH" | "WIRE_DOM">("ACH");
  const [resolveResult, setResolveResult] = useState<any>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    void loadHistory();
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

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
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
      const response = await onboardBusiness(form);
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
      setResolveError("UPI must be exactly 8 alphanumeric characters");
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
          <h1 className="hero-title">Manage master and child UPIs</h1>
          <p className="hero-subtitle">Attach new payout accounts, resolve identifiers, and copy details securely.</p>
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
        <div className="error-box">
          <strong>Please fix the following:</strong>
          <ul>
            {validationErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      <div className="card-grid" style={{ alignItems: "flex-start" }}>
        <BusinessForm form={form} loading={loading} onChange={handleChange} onSubmit={handleSubmit} />

        <div className="stacked-panels">
          {upi && <ResultCard upi={upi} />}
          {copyNotice && <div className="status-pill">{copyNotice}</div>}
          {historyError && <div className="error-box">{historyError}</div>}
          <HistoryPanel entries={history} onCopy={handleHistoryCopy} />
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
