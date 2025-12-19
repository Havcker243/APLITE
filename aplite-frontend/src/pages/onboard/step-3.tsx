import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/router";
import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { onboardingUploadId } from "../../utils/api";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";

export default function OnboardStep3() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const { step3, setStep3, step2, completedThrough, touchStep, markStepComplete } = useOnboardingWizard();

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const role = useMemo(() => (step2.role as "owner" | "authorized_rep" | undefined) || "", [step2.role]);
  const callBased = role === "owner";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    touchStep(3);
  }, [touchStep]);

  useEffect(() => {
    if (!mounted) return;
    // Guard: require local completion of Step 2 to be on Step 3.
    if (completedThrough < 2) {
      router.replace(completedThrough < 1 ? "/onboard/step-1" : "/onboard/step-2");
    }
  }, [mounted, completedThrough, router]);

  if (!ready || !token || !mounted) return <LoadingScreen />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(null);
    setError(null);
    try {
      let fileId = step3.file_id;
      if (!fileId && !callBased) {
        if (!step3.file) throw new Error("Upload a government ID document (jpg, png, or pdf).");
        const res = await onboardingUploadId(step3.file);
        fileId = res.file_id;
        setStep3((prev) => ({ ...prev, file_id: fileId }));
      }

      setSaved("Saved locally");
      markStepComplete(3);
      router.push("/onboard/step-4");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell title="Stage 3" subtitle="Verify a real person is associated with this business." activeStep={3}>
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

      <form className="card form-card" onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>Identity Verification</h2>
        <p className="hero-subtitle">
          {callBased
            ? "As the business owner, you'll complete a live verification call later. No document upload needed now."
            : "Authorized representatives must upload ID to verify their authority. Files are stored privately (MVP local storage)."}
        </p>

        <div className="form-section">
          <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 14 }}>
            <div className="input-group">
              <label className="input-label" htmlFor="full_name">
                Full legal name
              </label>
              <input id="full_name" className="input-control" value={step3.full_name} onChange={(e) => setStep3((p) => ({ ...p, full_name: e.target.value }))} required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="person_title">
                Title {callBased ? "(exec role)" : "(optional)"}
              </label>
              <input
                id="person_title"
                className="input-control"
                value={step3.title}
                onChange={(e) => setStep3((p) => ({ ...p, title: e.target.value }))}
                required={callBased}
              />
            </div>
            {!callBased && (
              <div className="input-group">
                <label className="input-label" htmlFor="id_file">
                  Government ID (jpg, png, pdf)
                </label>
                <input
                  id="id_file"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="input-control"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setStep3((p) => ({ ...p, file, file_id: undefined }));
                  }}
                  required={!step3.file_id}
                />
                {step3.file_id && <p className="hero-subtitle">Uploaded document reference: {step3.file_id}</p>}
              </div>
            )}

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <input type="checkbox" checked={step3.attestation} onChange={(e) => setStep3((p) => ({ ...p, attestation: e.target.checked }))} />
              <span className="hero-subtitle" style={{ marginTop: 2 }}>
                I attest that the information provided is accurate and that I am authorized to submit identity documents for this onboarding.
              </span>
            </label>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
          <button type="button" className="button button-secondary" onClick={() => router.push("/onboard/step-2")}>
            Back
          </button>
          <button className="button" type="submit" disabled={loading}>
            {loading && <span className="spinner" aria-hidden="true" />}
            Save & Continue
          </button>
        </div>
      </form>
    </OnboardingShell>
  );
}
