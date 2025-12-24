import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";
import { onboardingComplete } from "../../utils/api";

export default function OnboardVerify() {
  const router = useRouter();
  const { token, loading, refreshProfile, profile } = useAuth();
  const { step1, step2, step3, step4, completedThrough, clearDraft, touchStep, markStepComplete } = useOnboardingWizard();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pendingCall, setPendingCall] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const status = String(profile?.onboarding_status || "");
    if (status === "PENDING_CALL") {
      setPendingCall(true);
    }
  }, [profile]);

  React.useEffect(() => {
    touchStep(5);
    // Guard: require local completion through Step 4.
    if (completedThrough < 4) {
      router.replace(
        completedThrough < 1
          ? "/onboard/step-1"
          : completedThrough === 1
          ? "/onboard/step-2"
          : completedThrough === 2
          ? "/onboard/step-3"
          : "/onboard/step-4"
      );
    }
  }, [touchStep]);

  const maskedAccount = useMemo(() => {
    if (!step4.account_number) return "";
    const last4 = step4.account_number.slice(-4);
    return `•••• ${last4}`;
  }, [step4.account_number]);

  const verificationMethod = step2.role === "owner" ? "call" : "id";

  if (loading || !token || !mounted) return <LoadingScreen />;

  async function handleSubmit() {
    setSaving(true);
    setSaved(null);
    setError(null);
    try {
      const industry = step1.industry === "Other" ? step1.industry_other : step1.industry;
      if (step1.industry === "Other" && !step1.industry_other.trim()) {
        throw new Error("Industry is required. Select an industry or specify Other.");
      }
      if (!step2.role) throw new Error("Select your role on Step 2.");
      if (!step3.attestation) throw new Error("Attestation required on Step 3.");
      if (!step4.bank_name || !step4.account_number) throw new Error("Bank details are required on Step 4.");

      const file = step3.file || null;
      const payload = {
        org: {
          legal_name: step1.legal_name,
          dba: step1.dba || undefined,
          ein: step1.ein,
          formation_date: step1.formation_date,
          formation_state: step1.formation_state,
          entity_type: step1.entity_type,
          formation_documents: step1.formation_documents
            .filter((doc) => doc.file_id)
            .map((doc) => ({ doc_type: doc.doc_type, file_id: doc.file_id as string })),
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
        },
        role: {
          role: step2.role as "owner" | "authorized_rep",
          title: step2.title || undefined,
        },
        identity: {
          full_name: step3.full_name,
          title: step3.title || undefined,
          id_document_id: step3.file_id || undefined,
          phone: step3.phone || undefined,
          attestation: step3.attestation,
        },
        bank: {
          bank_name: step4.bank_name,
          account_number: step4.account_number,
          ach_routing: step4.ach_routing || undefined,
          wire_routing: step4.wire_routing || undefined,
          swift: step4.swift || undefined,
        },
        verification_method: verificationMethod,
        verification_code: undefined, // TODO: once real verification is wired, send OTP/call metadata here.
        file,
      };

      const res = await onboardingComplete(payload);
      // Refresh server profile so routing uses the latest onboarding_status.
      await refreshProfile();
      markStepComplete(5);
      if (res.status === "PENDING_CALL") {
        setPendingCall(true);
        setSaved("Submitted. Verification call pending. We will reach out shortly.");
        return;
      }
      clearDraft();
      setSaved(`Verified. Issued UPI: ${res.upi}`);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete onboarding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingShell title="Stage 5" subtitle="Review and submit to complete onboarding." activeStep={5}>
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

      <div className="card form-card">
        <h2 style={{ marginTop: 0 }}>Review</h2>
        <p className="hero-subtitle">Confirm your details, then submit to issue your UPI.</p>

        <div className="form-section">
          <p className="section-title">Business identity</p>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 10 }}>
            <div className="input-group">
              <label className="input-label">Legal name</label>
              <div className="hero-subtitle">{step1.legal_name || "-"}</div>
            </div>
            {step1.dba && (
              <div className="input-group">
                <label className="input-label">DBA</label>
                <div className="hero-subtitle">{step1.dba}</div>
              </div>
            )}
            <div className="input-group">
              <label className="input-label">EIN</label>
              <div className="hero-subtitle">{step1.ein || "-"}</div>
            </div>
            <div className="input-group">
              <label className="input-label">Entity</label>
              <div className="hero-subtitle">
                {step1.entity_type || "-"} · {step1.formation_state || "-"} · {step1.formation_date || "-"}
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Address</label>
              <div className="hero-subtitle">
                {[step1.street1, step1.street2, step1.city, step1.state, step1.zip, step1.country].filter(Boolean).join(", ")}
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Industry</label>
              <div className="hero-subtitle">
                {step1.industry === "Other" ? step1.industry_other || "Other" : step1.industry || "-"}
              </div>
            </div>
            {step1.website && (
              <div className="input-group">
                <label className="input-label">Website</label>
                <div className="hero-subtitle">{step1.website}</div>
              </div>
            )}
            {step1.description && (
              <div className="input-group">
                <label className="input-label">Description</label>
                <div className="hero-subtitle">{step1.description}</div>
              </div>
            )}
            {step1.formation_documents.length > 0 && (
              <div className="input-group">
                <label className="input-label">Formation documents</label>
                <div className="hero-subtitle">
                  {step1.formation_documents
                    .filter((doc) => doc.file_id)
                    .map((doc) => doc.doc_type.replace(/_/g, " "))
                    .join(", ") || "-"}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-section" style={{ marginTop: 16 }}>
          <p className="section-title">Authorization & Identity</p>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 10 }}>
            <div className="input-group">
              <label className="input-label">Role</label>
              <div className="hero-subtitle">
                {step2.role || "-"} {step2.title ? `· ${step2.title}` : ""}
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Full name</label>
              <div className="hero-subtitle">{step3.full_name || "-"}</div>
            </div>
            <div className="input-group">
              <label className="input-label">Title</label>
              <div className="hero-subtitle">{step3.title || "-"}</div>
            </div>
            {verificationMethod !== "call" && (
              <div className="input-group">
                <label className="input-label">ID document</label>
                <div className="hero-subtitle">
                  {step3.file_id ? `Uploaded (${step3.file_id})` : step3.file ? step3.file.name : "Not provided"}
                </div>
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Attestation</label>
              <div className="hero-subtitle">{step3.attestation ? "Yes" : "No"}</div>
            </div>
          </div>
        </div>

        <div className="form-section" style={{ marginTop: 16 }}>
          <p className="section-title">Verification path</p>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 10 }}>
            <div className="input-group">
              <label className="input-label">Method</label>
              <div className="hero-subtitle">
                {verificationMethod === "call"
                  ? "Owner call verification (scheduling to be added)."
                  : "Document verification (ID uploaded)."}
              </div>
              {verificationMethod === "call" && (
                <p className="hero-subtitle" style={{ marginTop: 6 }}>
                  TODO: Integrate Zoom/Calendly scheduling and gate final verification on call completion.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="form-section" style={{ marginTop: 16 }}>
          <p className="section-title">Bank details</p>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 10 }}>
            <div className="input-group">
              <label className="input-label">Bank name</label>
              <div className="hero-subtitle">{step4.bank_name || "-"}</div>
            </div>
            <div className="input-group">
              <label className="input-label">Account number</label>
              <div className="hero-subtitle">{maskedAccount || "-"}</div>
            </div>
            <div className="input-group">
              <label className="input-label">ACH routing</label>
              <div className="hero-subtitle">{step4.ach_routing || "-"}</div>
            </div>
            <div className="input-group">
              <label className="input-label">Wire routing</label>
              <div className="hero-subtitle">{step4.wire_routing || "-"}</div>
            </div>
            <div className="input-group">
              <label className="input-label">SWIFT/BIC</label>
              <div className="hero-subtitle">{step4.swift || "-"}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
          <button type="button" className="button button-secondary" onClick={() => router.push("/onboard/step-4")}>
            Back
          </button>
          <button type="button" className="button" onClick={handleSubmit} disabled={saving || pendingCall}>
            {saving && <span className="spinner" aria-hidden="true" />}
            {pendingCall ? "Pending verification" : "Submit & Finish"}
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
