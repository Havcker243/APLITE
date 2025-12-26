import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { useAuth } from "../../utils/auth";
import {
  normalizeRouting,
  useOnboardingWizard,
} from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";

export default function OnboardStep4() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const { step4, setStep4, completedThrough, touchStep, markStepComplete } = useOnboardingWizard();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);


  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    touchStep(4);
  }, [touchStep]);

  useEffect(() => {
    if (!mounted) return;
    if (completedThrough < 3) {
      router.replace(
        completedThrough < 1
          ? "/onboard/step-1"
          : completedThrough === 1
          ? "/onboard/step-2"
          : "/onboard/step-3"
      );
    }
  }, [mounted, completedThrough, router]);

  if (loading || !token || !mounted) return <LoadingScreen />;


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(null);
    setError(null);
    try {
      setSaved("Saved locally");
      markStepComplete(4);
      router.push("/onboard/step-5");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingShell
      title="Stage 4"
      subtitle="Add at least one payout rail for this business."
      activeStep={4}
    >
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
        <h2 style={{ marginTop: 0 }}>Bank Details</h2>
        <p className="hero-subtitle">
          Provide an account number and at least one routing identifier (ACH,
          wire, or SWIFT).
        </p>

        <div
          className="form-grid"
          style={{ gridTemplateColumns: "1fr", marginTop: 14 }}
        >
          <div className="input-group">
            <label className="input-label" htmlFor="bank_name">
              Bank name
            </label>
            <input
              id="bank_name"
              className="input-control"
              value={step4.bank_name}
              onChange={(e) =>
                setStep4((p) => ({ ...p, bank_name: e.target.value }))
              }
              required
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="account_number">
              Account number
            </label>
            <input
              id="account_number"
              className="input-control mono"
              value={step4.account_number}
              onChange={(e) =>
                setStep4((p) => ({
                  ...p,
                  account_number: normalizeRouting(e.target.value, 32),
                }))
              }
              required
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="ach_routing">
              ACH routing (optional)
            </label>
            <input
              id="ach_routing"
              className="input-control mono"
              value={step4.ach_routing}
              onChange={(e) =>
                setStep4((p) => ({
                  ...p,
                  ach_routing: normalizeRouting(e.target.value, 9),
                }))
              }
              placeholder="9 digits"
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="wire_routing">
              Wire routing (optional)
            </label>
            <input
              id="wire_routing"
              className="input-control mono"
              value={step4.wire_routing}
              onChange={(e) =>
                setStep4((p) => ({
                  ...p,
                  wire_routing: normalizeRouting(e.target.value, 34),
                }))
              }
              placeholder="Digits only"
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
              onChange={(e) =>
                setStep4((p) => ({
                  ...p,
                  swift: e.target.value.toUpperCase().replace(/\s/g, ""),
                }))
              }
              placeholder="8 or 11 chars"
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 18,
          }}
        >
          <button
            type="button"
            className="button button-secondary"
            onClick={() => router.push("/onboard/step-3")}
          >
            Back
          </button>
          <button className="button" type="submit" disabled={saving}>
            {saving && <span className="spinner" aria-hidden="true" />}
            Save & Continue
          </button>
        </div>
      </form>
    </OnboardingShell>
  );
}
