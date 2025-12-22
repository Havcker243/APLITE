import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import Link from "next/link";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";

export default function OnboardStep2() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const {
    step2,
    setStep2,
    completedThrough,
    touchStep,
    markStepComplete,
  } = useOnboardingWizard();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    touchStep(2);
    // Guard: require local completion of Step 1 to be on Step 2.
    if (completedThrough < 1) {
      router.replace("/onboard/step-1");
    }
  }, [touchStep, completedThrough, router]);

  if (loading || !token || !mounted) return <LoadingScreen />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(null);
    setError(null);
    try {
      if (!step2.role) throw new Error("Select your role to continue.");
      setSaved("Saved locally");
      markStepComplete(2);
      router.push("/onboard/step-3");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingShell
      title="Stage 2"
      subtitle="Confirm authorization to bind this business."
      activeStep={2}
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
        <h2 style={{ marginTop: 0 }}>Confirm Authorization</h2>
        <p className="hero-subtitle">
          Select who has legal authority to bind this business.
        </p>

        <div className="select-card-grid" style={{ marginTop: 14 }}>
          <div
            className={`select-card${
              step2.role === "owner" ? " select-card--selected" : ""
            }`}
            role="button"
            tabIndex={0}
            onClick={() => setStep2((p) => ({ ...p, role: "owner" }))}
            onKeyDown={(e) =>
              e.key === "Enter" && setStep2((p) => ({ ...p, role: "owner" }))
            }
          >
            <p className="select-card-title">I am the Business Owner</p>
            <p className="select-card-desc">
              Lower-risk path when the owner is completing onboarding.
            </p>
          </div>
          <div
            className={`select-card${
              step2.role === "authorized_rep" ? " select-card--selected" : ""
            }`}
            role="button"
            tabIndex={0}
            onClick={() => setStep2((p) => ({ ...p, role: "authorized_rep" }))}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              setStep2((p) => ({ ...p, role: "authorized_rep" }))
            }
          >
            <p className="select-card-title">
              I am an Authorized Representative
            </p>
            <p className="select-card-desc">
              Higher scrutiny. Executive title is required.
            </p>
          </div>
        </div>

        {step2.role === "authorized_rep" && (
          <div className="input-group" style={{ marginTop: 14 }}>
            <label className="input-label" htmlFor="title">
              Executive Title
            </label>
            <select
              id="title"
              className="input-control"
              value={step2.title}
              onChange={(e) =>
                setStep2((p) => ({ ...p, title: e.target.value }))
              }
              required
            >
              <option value="">Select...</option>
              <option value="CEO">CEO</option>
              <option value="COO">COO</option>
              <option value="CFO">CFO</option>
              <option value="President">President</option>
              <option value="VP">VP</option>
              <option value="Director">Director</option>
            </select>
          </div>
        )}

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
            onClick={() => router.push("/onboard/step-1")}
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
