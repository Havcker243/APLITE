import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { verifyAvailableSlots, verifyConfirmOtp, verifyScheduleCall, verifySendOtp } from "../../utils/api";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";

export default function OnboardVerify() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const { currentStep, session, refreshSession, verify, setVerify } = useOnboardingWizard();

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [slots, setSlots] = useState<string[]>([]);

  const riskLevel = useMemo(() => (session?.risk_level as "low" | "medium" | "high") || "low", [session]);

  useEffect(() => {
    if (currentStep !== 5) return;
    if (riskLevel !== "high") return;
    void (async () => {
      try {
        const res = await verifyAvailableSlots();
        setSlots(res.slots);
      } catch {
        // ignore
      }
    })();
  }, [currentStep, riskLevel]);

  if (!ready) return null;
  if (!token) return null;
  if (currentStep < 5) {
    router.replace("/onboard/step-4");
    return null;
  }

  async function handleSendOtp() {
    setLoading(true);
    setSaved(null);
    setError(null);
    try {
      await verifySendOtp(verify.otpMethod);
      setSaved("Code sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmOtp() {
    setLoading(true);
    setSaved(null);
    setError(null);
    try {
      const res = await verifyConfirmOtp(verify.otpCode.trim());
      setSaved(`Verified. Issued UPI: ${res.upi}`);
      await refreshSession();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to confirm OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleScheduleCall() {
    setLoading(true);
    setSaved(null);
    setError(null);
    try {
      if (!verify.selectedSlot) throw new Error("Select a time slot to schedule the call.");
      await verifyScheduleCall(verify.selectedSlot);
      setSaved("Call scheduled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to schedule call");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell title="Stage 5" subtitle="Confirm verification to complete onboarding." activeStep={5}>
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
        <h2 style={{ marginTop: 0 }}>Verify</h2>
        <p className="hero-subtitle">We’ll send a verification code to confirm you control this account.</p>

        <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 14 }}>
          <div className="input-group">
            <label className="input-label" htmlFor="method">
              Delivery method
            </label>
            <select id="method" className="input-control" value={verify.otpMethod} onChange={(e) => setVerify((p) => ({ ...p, otpMethod: e.target.value as any }))}>
              <option value="email">Email</option>
              <option value="sms">SMS (dev)</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="button button-secondary" onClick={handleSendOtp} disabled={loading}>
              {loading && <span className="spinner" aria-hidden="true" />}
              Send Code
            </button>
            <input
              className="input-control mono"
              placeholder="6-digit code"
              value={verify.otpCode}
              onChange={(e) => setVerify((p) => ({ ...p, otpCode: e.target.value }))}
              maxLength={6}
              inputMode="numeric"
            />
            <button type="button" className="button" onClick={handleConfirmOtp} disabled={loading}>
              {loading && <span className="spinner" aria-hidden="true" />}
              Confirm
            </button>
          </div>

          {riskLevel === "high" && (
            <div className="input-group" style={{ marginTop: 14 }}>
              <p className="section-title">High risk: schedule call</p>
              <p className="hero-subtitle">For high-risk cases, you can schedule a verification call (MVP deterministic slots).</p>
              <select className="input-control" value={verify.selectedSlot} onChange={(e) => setVerify((p) => ({ ...p, selectedSlot: e.target.value }))}>
                <option value="">Select a slot…</option>
                {slots.map((slot) => (
                  <option key={slot} value={slot}>
                    {new Date(slot).toLocaleString()}
                  </option>
                ))}
              </select>
              <button type="button" className="button button-secondary" style={{ marginTop: 10 }} onClick={handleScheduleCall} disabled={loading}>
                Schedule Call
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
          <button type="button" className="button button-secondary" onClick={() => router.push("/onboard/step-4")}>
            Back
          </button>
          <button type="button" className="button" onClick={() => router.push("/dashboard")}>
            Skip for now
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}

