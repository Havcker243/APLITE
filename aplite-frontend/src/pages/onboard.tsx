import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { OnboardingStepper } from "../components/OnboardingStepper";
import {
  onboardingCurrent,
  onboardingStep1,
  onboardingStep2,
  onboardingStep3,
  onboardingStep4,
  onboardingUploadId,
  verifyAvailableSlots,
  verifyConfirmOtp,
  verifyScheduleCall,
  verifySendOtp,
} from "../utils/api";
import { useAuth } from "../utils/auth";
import { CA_PROVINCES, COUNTRIES, isCanada, isUnitedStates, US_STATES } from "../utils/geo";

type Step = 1 | 2 | 3 | 4 | 5;

function normalizeEIN(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function normalizeRouting(raw: string, max = 34) {
  return raw.replace(/\D/g, "").slice(0, max);
}

export default function OnboardPage() {
  const router = useRouter();
  const { token, ready } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<any>(null);

  const [step1, setStep1] = useState({
    legal_name: "",
    dba: "",
    ein: "",
    formation_date: "",
    formation_state: "",
    entity_type: "LLC",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    industry: "",
    industry_other: "",
    website: "",
    description: "",
  });

  const bizIsUS = isUnitedStates(step1.country);
  const bizIsCA = isCanada(step1.country);

  const [step2, setStep2] = useState<{ role: "owner" | "authorized_rep" | ""; title: string }>({ role: "", title: "" });
  const [step3, setStep3] = useState<{ full_name: string; title: string; file?: File; file_id?: string; attestation: boolean }>({
    full_name: "",
    title: "",
    file: undefined,
    file_id: undefined,
    attestation: false,
  });
  const [step4, setStep4] = useState({ bank_name: "", account_number: "", ach_routing: "", wire_routing: "", swift: "" });

  const [otpMethod, setOtpMethod] = useState<"email" | "sms">("email");
  const [otpCode, setOtpCode] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/signup?next=/onboard");
      return;
    }
    void loadSession();
  }, [ready, token, router]);

  async function loadSession() {
    try {
      const current = await onboardingCurrent();
      setSession(current);
      const next = Math.min(Math.max(current.current_step || 1, 1), 5) as Step;
      setStep(next);
      setError(null);
    } catch {
      // no existing session is fine; user starts at step 1
      setSession(null);
      setStep(1);
    }
  }

  const riskLevel = useMemo(() => (session?.risk_level as "low" | "medium" | "high") || "low", [session]);

  useEffect(() => {
    if (step !== 5) return;
    if (riskLevel !== "high") return;
    void (async () => {
      try {
        const res = await verifyAvailableSlots();
        setSlots(res.slots);
      } catch {
        // ignore
      }
    })();
  }, [step, riskLevel]);

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(null);
    try {
      const industry = step1.industry === "Other" ? step1.industry_other : step1.industry;
      if (step1.industry === "Other" && !step1.industry_other.trim()) {
        throw new Error("Industry is required. Select an industry or specify Other.");
      }
      const res = await onboardingStep1({
        legal_name: step1.legal_name,
        dba: step1.dba || undefined,
        ein: step1.ein,
        formation_date: step1.formation_date,
        formation_state: step1.formation_state,
        entity_type: step1.entity_type,
        address: {
          street1: step1.street1,
          street2: step1.street2 || undefined,
          city: step1.city,
          state: step1.state,
          zip: step1.zip,
          country: step1.country,
        },
        industry,
        website: step1.website || undefined,
        description: step1.description || undefined,
      });
      window.localStorage.setItem("aplite_onboarding_session", res.session_id);
      setSaved("Saved");
      await loadSession();
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(null);
    try {
      if (!step2.role) throw new Error("Select your role to continue.");
      await onboardingStep2({ role: step2.role as any, title: step2.role === "authorized_rep" ? step2.title : undefined });
      setSaved("Saved");
      await loadSession();
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep3Submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(null);
    try {
      let fileId = step3.file_id;
      if (!fileId) {
        if (!step3.file) throw new Error("Upload a government ID document (jpg, png, or pdf).");
        const res = await onboardingUploadId(step3.file);
        fileId = res.file_id;
        setStep3((prev) => ({ ...prev, file_id: fileId }));
      }

      await onboardingStep3({
        full_name: step3.full_name,
        title: step3.title || undefined,
        id_document_id: fileId!,
        attestation: step3.attestation,
      });
      setSaved("Saved");
      await loadSession();
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep4Submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(null);
    try {
      await onboardingStep4({
        bank_name: step4.bank_name,
        account_number: step4.account_number,
        ach_routing: step4.ach_routing || undefined,
        wire_routing: step4.wire_routing || undefined,
        swift: step4.swift || undefined,
      });
      setSaved("Saved");
      await loadSession();
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    setLoading(true);
    setError(null);
    setSaved(null);
    try {
      await verifySendOtp(otpMethod);
      setSaved("Code sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmOtp() {
    setLoading(true);
    setError(null);
    setSaved(null);
    try {
      const res = await verifyConfirmOtp(otpCode.trim());
      setSaved(`Verified. Issued UPI: ${res.upi}`);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to confirm OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleScheduleCall() {
    setLoading(true);
    setError(null);
    setSaved(null);
    try {
      if (!selectedSlot) throw new Error("Select a time slot to schedule the call.");
      await verifyScheduleCall(selectedSlot);
      setSaved("Call scheduled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to schedule call");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;
  if (!token) return null;

  return (
    <div className="page-container onboarding-container">
      <section className="hero" style={{ marginBottom: 10 }}>
        <div>
          <p className="section-title">Onboarding</p>
          <h1 className="hero-title">KYB/KYC verification</h1>
          <p className="hero-subtitle">This flow is strict by design. We handle real money, so details must be verified.</p>
        </div>
      </section>

      <OnboardingStepper currentStep={step} />

      {saved && (
        <div className="status-pill" role="status" aria-live="polite">
          {saved}
        </div>
      )}

      {error && (
        <div className="error-box" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {step === 1 && (
        <form className="card form-card" onSubmit={handleStep1Submit}>
          <p className="section-title">Stage 1</p>
          <h2 style={{ marginTop: 0 }}>Establish Legal Entity</h2>
          <p className="hero-subtitle">Provide your official business information. Once submitted, your address becomes read-only.</p>

          <div className="form-section">
            <p className="section-title">Business identity</p>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 12 }}>
              <div className="input-group">
                <label className="input-label" htmlFor="legal_name">
                  Legal name
                </label>
                <input
                  id="legal_name"
                  className="input-control"
                  value={step1.legal_name}
                  onChange={(e) => setStep1((p) => ({ ...p, legal_name: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="dba">
                  DBA (optional)
                </label>
                <input id="dba" className="input-control" value={step1.dba} onChange={(e) => setStep1((p) => ({ ...p, dba: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="ein">
                  EIN
                </label>
                <input
                  id="ein"
                  className="input-control mono"
                  value={step1.ein}
                  onChange={(e) => setStep1((p) => ({ ...p, ein: normalizeEIN(e.target.value) }))}
                  placeholder="12-3456789"
                  required
                />
                <span className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
                  Format: NN-NNNNNNN
                </span>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="formation_date">
                  Formation date
                </label>
                <input
                  id="formation_date"
                  type="date"
                  className="input-control"
                  value={step1.formation_date}
                  onChange={(e) => setStep1((p) => ({ ...p, formation_date: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="formation_state">
                  Formation state
                </label>
                <input
                  id="formation_state"
                  list={bizIsUS ? "formation-states-us" : bizIsCA ? "formation-provinces-ca" : undefined}
                  className="input-control"
                  value={step1.formation_state}
                  onChange={(e) => setStep1((p) => ({ ...p, formation_state: e.target.value }))}
                  placeholder={bizIsUS ? "CA" : bizIsCA ? "ON" : "State / Region"}
                  required
                />
                {bizIsUS && (
                  <datalist id="formation-states-us">
                    {US_STATES.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                )}
                {bizIsCA && (
                  <datalist id="formation-provinces-ca">
                    {CA_PROVINCES.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                )}
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="entity_type">
                  Entity type
                </label>
                <select id="entity_type" className="input-control" value={step1.entity_type} onChange={(e) => setStep1((p) => ({ ...p, entity_type: e.target.value }))}>
                  <option value="LLC">LLC</option>
                  <option value="C-Corp">C-Corp</option>
                  <option value="S-Corp">S-Corp</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Non-Profit">Non-Profit</option>
                  <option value="Sole Proprietor">Sole Proprietor</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <p className="section-title">Legal address</p>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 12 }}>
              <div className="input-group">
                <label className="input-label" htmlFor="street1">
                  Street 1
                </label>
                <input id="street1" className="input-control" value={step1.street1} onChange={(e) => setStep1((p) => ({ ...p, street1: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="street2">
                  Street 2 (optional)
                </label>
                <input id="street2" className="input-control" value={step1.street2} onChange={(e) => setStep1((p) => ({ ...p, street2: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="city">
                  City
                </label>
                <input id="city" className="input-control" value={step1.city} onChange={(e) => setStep1((p) => ({ ...p, city: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="state">
                  State
                </label>
                <input
                  id="state"
                  list={bizIsUS ? "address-states-us" : bizIsCA ? "address-provinces-ca" : undefined}
                  className="input-control"
                  value={step1.state}
                  onChange={(e) => setStep1((p) => ({ ...p, state: e.target.value }))}
                  placeholder={bizIsUS ? "CA" : bizIsCA ? "ON" : "State / Region"}
                  required
                />
                {bizIsUS && (
                  <datalist id="address-states-us">
                    {US_STATES.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                )}
                {bizIsCA && (
                  <datalist id="address-provinces-ca">
                    {CA_PROVINCES.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                )}
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="zip">
                  ZIP
                </label>
                <input id="zip" className="input-control mono" value={step1.zip} onChange={(e) => setStep1((p) => ({ ...p, zip: e.target.value }))} placeholder="94105" required />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="country">
                  Country
                </label>
                <input
                  id="country"
                  list="countries"
                  className="input-control"
                  value={step1.country}
                  onChange={(e) => setStep1((p) => ({ ...p, country: e.target.value, state: "", formation_state: "" }))}
                  placeholder="United States"
                  required
                />
                <datalist id="countries">
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          <div className="form-section">
            <p className="section-title">Business profile</p>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 12 }}>
              <div className="input-group">
                <label className="input-label" htmlFor="industry">
                  Industry
                </label>
                <select id="industry" className="input-control" value={step1.industry} onChange={(e) => setStep1((p) => ({ ...p, industry: e.target.value }))} required>
                  <option value="">Select…</option>
                  <option value="Software">Software</option>
                  <option value="Fintech">Fintech</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="Marketplace">Marketplace</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {step1.industry === "Other" && (
                <div className="input-group">
                  <label className="input-label" htmlFor="industry_other">
                    Specify industry
                  </label>
                  <input
                    id="industry_other"
                    className="input-control"
                    value={step1.industry_other}
                    onChange={(e) => setStep1((p) => ({ ...p, industry_other: e.target.value }))}
                    required
                  />
                </div>
              )}
              <div className="input-group">
                <label className="input-label" htmlFor="website">
                  Website (domain)
                </label>
                <input
                  id="website"
                  className="input-control mono"
                  value={step1.website}
                  onChange={(e) => setStep1((p) => ({ ...p, website: e.target.value }))}
                  placeholder="example.com"
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="description">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  className="input-control"
                  rows={3}
                  value={step1.description}
                  onChange={(e) => setStep1((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Briefly describe what you do. This is logged for compliance."
                />
              </div>
            </div>
          </div>

          <button className="button" type="submit" disabled={loading}>
            {loading && <span className="spinner" aria-hidden="true" />}
            Save & Continue
          </button>
        </form>
      )}

      {step === 2 && (
        <form className="card form-card" onSubmit={handleStep2Submit}>
          <p className="section-title">Stage 2</p>
          <h2 style={{ marginTop: 0 }}>Confirm Authorization</h2>
          <p className="hero-subtitle">Select who has legal authority to bind this business.</p>

          <div className="select-card-grid" style={{ marginTop: 14 }}>
            <div
              className={`select-card${step2.role === "owner" ? " select-card--selected" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setStep2((p) => ({ ...p, role: "owner" }))}
              onKeyDown={(e) => e.key === "Enter" && setStep2((p) => ({ ...p, role: "owner" }))}
            >
              <p className="select-card-title">I am the Business Owner</p>
              <p className="select-card-desc">Lower-risk path when the owner is completing onboarding.</p>
            </div>
            <div
              className={`select-card${step2.role === "authorized_rep" ? " select-card--selected" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setStep2((p) => ({ ...p, role: "authorized_rep" }))}
              onKeyDown={(e) => e.key === "Enter" && setStep2((p) => ({ ...p, role: "authorized_rep" }))}
            >
              <p className="select-card-title">I am an Authorized Representative</p>
              <p className="select-card-desc">Higher scrutiny. Executive title is required.</p>
            </div>
          </div>

          {step2.role === "authorized_rep" && (
            <div className="input-group" style={{ marginTop: 14 }}>
              <label className="input-label" htmlFor="title">
                Executive Title
              </label>
              <select id="title" className="input-control" value={step2.title} onChange={(e) => setStep2((p) => ({ ...p, title: e.target.value }))} required>
                <option value="">Select…</option>
                <option value="CEO">CEO</option>
                <option value="COO">COO</option>
                <option value="CFO">CFO</option>
                <option value="President">President</option>
                <option value="VP">VP</option>
                <option value="Director">Director</option>
              </select>
            </div>
          )}

          <button className="button" type="submit" disabled={loading}>
            {loading && <span className="spinner" aria-hidden="true" />}
            Save & Continue
          </button>
        </form>
      )}

      {step === 3 && (
        <form className="card form-card" onSubmit={handleStep3Submit}>
          <p className="section-title">Stage 3</p>
          <h2 style={{ marginTop: 0 }}>Identity Verification</h2>
          <p className="hero-subtitle">Tie a real human to this authority. Files are stored privately.</p>

          <div className="form-section">
            <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label" htmlFor="full_name">
                  Full legal name
                </label>
                <input
                  id="full_name"
                  className="input-control"
                  value={step3.full_name}
                  onChange={(e) => setStep3((p) => ({ ...p, full_name: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="person_title">
                  Title
                </label>
                <input
                  id="person_title"
                  className="input-control"
                  value={step3.title}
                  onChange={(e) => setStep3((p) => ({ ...p, title: e.target.value }))}
                  placeholder="CEO, COO, …"
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="id_file">
                  Government ID
                </label>
                <input
                  id="id_file"
                  type="file"
                  className="input-control"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setStep3((p) => ({ ...p, file: e.target.files?.[0] }))}
                />
                <span className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
                  {step3.file_id ? `Uploaded: ${step3.file_id}` : step3.file ? `Selected: ${step3.file.name}` : "Accepted: jpg, png, pdf. Max 10MB."}
                </span>
              </div>
            </div>
          </div>

          <label className="inline-row" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={step3.attestation} onChange={(e) => setStep3((p) => ({ ...p, attestation: e.target.checked }))} />
            <span className="hero-subtitle" style={{ margin: 0 }}>
              I confirm I have the legal authority to bind this business and that all provided information is accurate.
            </span>
          </label>

          <button className="button" type="submit" disabled={loading}>
            {loading && <span className="spinner" aria-hidden="true" />}
            Save & Continue
          </button>
        </form>
      )}

      {step === 4 && (
        <form className="card form-card" onSubmit={handleStep4Submit}>
          <p className="section-title">Stage 4</p>
          <h2 style={{ marginTop: 0 }}>Payment Rail Resolution</h2>
          <div className="status-pill" style={{ marginBottom: 16 }}>
            All data is encrypted and securely stored.
          </div>

          <div className="form-section">
            <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="input-group">
                <label className="input-label" htmlFor="bank_name">
                  Bank name
                </label>
                <input id="bank_name" className="input-control" value={step4.bank_name} onChange={(e) => setStep4((p) => ({ ...p, bank_name: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="account_number">
                  Account number
                </label>
                <input
                  id="account_number"
                  className="input-control mono"
                  value={step4.account_number}
                  onChange={(e) => setStep4((p) => ({ ...p, account_number: e.target.value.replace(/\D/g, "") }))}
                  inputMode="numeric"
                  required
                />
                <span className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
                  Never stored or returned in plaintext. Only last4 is retained for display.
                </span>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="ach_routing">
                  ACH routing
                </label>
                <input
                  id="ach_routing"
                  className="input-control mono"
                  value={step4.ach_routing}
                  onChange={(e) => setStep4((p) => ({ ...p, ach_routing: normalizeRouting(e.target.value, 9) }))}
                  placeholder="9 digits"
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="wire_routing">
                  Wire routing
                </label>
                <input
                  id="wire_routing"
                  className="input-control mono"
                  value={step4.wire_routing}
                  onChange={(e) => setStep4((p) => ({ ...p, wire_routing: normalizeRouting(e.target.value, 34) }))}
                  placeholder="Numeric"
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="swift">
                  SWIFT/BIC (optional)
                </label>
                <input
                  id="swift"
                  className="input-control mono"
                  value={step4.swift}
                  onChange={(e) => setStep4((p) => ({ ...p, swift: e.target.value.toUpperCase() }))}
                  placeholder="8 or 11 chars"
                />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18, padding: 18 }}>
            <p className="section-title">Legal address (read-only)</p>
            <p className="hero-subtitle" style={{ margin: 0 }}>
              {session?.org?.address?.street1 || "—"}
              {session?.org?.address?.street2 ? `, ${session?.org?.address?.street2}` : ""}
              <br />
              {[session?.org?.address?.city, session?.org?.address?.state, session?.org?.address?.zip].filter(Boolean).join(", ") || "—"}
            </p>
          </div>

          <button className="button" type="submit" disabled={loading}>
            {loading && <span className="spinner" aria-hidden="true" />}
            Save & Continue
          </button>
        </form>
      )}

      {step === 5 && (
        <div className="card form-card">
          <p className="section-title">Stage 5</p>
          <h2 style={{ marginTop: 0 }}>Final verification</h2>
          <p className="hero-subtitle">Before issuance, verification is required. Method is chosen based on risk.</p>

          {riskLevel !== "high" ? (
            <>
              <div className="inline-row" style={{ marginTop: 14 }}>
                <label className="input-label" style={{ minWidth: 120 }}>
                  Method
                </label>
                <select className="input-control" value={otpMethod} onChange={(e) => setOtpMethod(e.target.value as any)} style={{ maxWidth: 240 }}>
                  <option value="email">Email OTP</option>
                  <option value="sms">SMS OTP</option>
                </select>
                <button type="button" className="button button-secondary" onClick={handleSendOtp} disabled={loading}>
                  Send code
                </button>
              </div>

              <div className="inline-row" style={{ marginTop: 14 }}>
                <label className="input-label" style={{ minWidth: 120 }}>
                  Code
                </label>
                <input
                  className="input-control mono"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  style={{ maxWidth: 240 }}
                />
                <button type="button" className="button" onClick={handleConfirmOtp} disabled={loading || otpCode.length !== 6}>
                  {loading && <span className="spinner" aria-hidden="true" />}
                  Confirm
                </button>
              </div>

              <p className="hero-subtitle" style={{ marginTop: 12 }}>
                If you don’t receive the code, verify your email address and try again. (SMS is simulated in dev.)
              </p>
            </>
          ) : (
            <>
              <div className="status-pill" style={{ marginTop: 14 }}>
                High risk: verification call required
              </div>

              <div className="input-group" style={{ marginTop: 14 }}>
                <label className="input-label" htmlFor="slot">
                  Select a time
                </label>
                <select id="slot" className="input-control" value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)}>
                  <option value="">Select…</option>
                  {slots.map((s) => (
                    <option key={s} value={s}>
                      {new Date(s).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <button type="button" className="button" onClick={handleScheduleCall} disabled={loading}>
                {loading && <span className="spinner" aria-hidden="true" />}
                Schedule verification call
              </button>

              <p className="hero-subtitle" style={{ marginTop: 12 }}>
                In MVP/dev, call completion can be simulated from the backend endpoint `POST /verify/complete-call`.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
