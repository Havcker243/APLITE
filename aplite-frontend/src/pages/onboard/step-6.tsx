import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";

const CalEmbed = dynamic(() => import("../../components/CalEmbed").then((mod) => mod.CalEmbed), { ssr: false });

export default function OnboardStep6() {
  const router = useRouter();
  const { token, loading, profile } = useAuth();
  const { completedThrough, touchStep, markStepComplete } = useOnboardingWizard();

  const [mounted, setMounted] = useState(false);
  const [callScheduled, setCallScheduled] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const onboardingStatus = useMemo(() => String(profile?.onboarding_status || "NOT_STARTED"), [profile]);
  const needsCall = onboardingStatus === "PENDING_CALL";

  const calLink = process.env.NEXT_PUBLIC_CAL_LINK || "";
  const calUsername = process.env.NEXT_PUBLIC_CAL_USERNAME || "";
  const calEventSlug = process.env.NEXT_PUBLIC_CAL_EVENT_SLUG || "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    touchStep(6);
    if (!needsCall && completedThrough < 5) {
      router.replace("/onboard/step-5");
    }
  }, [touchStep, completedThrough, needsCall, router]);

  useEffect(() => {
    if (callScheduled) {
      markStepComplete(6);
      router.push("/onboard/pending");
    }
  }, [callScheduled, markStepComplete, router]);

  if (loading || !token || !mounted) return <LoadingScreen />;

  if (onboardingStatus === "VERIFIED") {
    return (
      <OnboardingShell title="Stage 6" subtitle="Verification complete." activeStep={6}>
        <div className="status-pill" role="status" aria-live="polite">
          Verified. You can continue to your dashboard.
        </div>
        <button className="button" onClick={() => router.push("/dashboard")}>
          Go to dashboard
        </button>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell title="Stage 6" subtitle="Schedule your verification call." activeStep={6}>
      {needsCall ? (
        <div className="status-pill" role="status" aria-live="polite">
          Verification pending. Book or reschedule your call below.
        </div>
      ) : (
        <div className="status-pill" role="status" aria-live="polite">
          Almost there. Schedule your verification call to proceed.
        </div>
      )}

      <div className="card form-card">
        <h2 style={{ marginTop: 0 }}>Final step: verification call</h2>
        <p className="hero-subtitle" style={{ marginBottom: 16 }}>
          You are almost done. Book a short call so we can verify the details you submitted and activate your account.
        </p>
        <button className="button" type="button" onClick={() => setShowModal(true)}>
          Book verification call
        </button>
      </div>

      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Schedule verification call">
          <div className="modal-card soft-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0 }}>Book your call</h2>
              <button className="button button-secondary" type="button" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
            <p className="hero-subtitle" style={{ marginTop: 8, marginBottom: 16 }}>
              Pick a time that works for you. We will verify details and activate your account.
            </p>
            <CalEmbed
              calLink={calLink}
              username={calUsername}
              eventSlug={calEventSlug}
              onSchedule={() => setCallScheduled(true)}
              variant="inline"
            />
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}
