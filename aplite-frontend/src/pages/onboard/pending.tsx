import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { LoadingScreen } from "../../components/LoadingScreen";
import { fetchProfileDetails } from "../../utils/api";
import { useAuth } from "../../utils/auth";

const POLL_INTERVAL_MS = 8000;

export default function OnboardPendingPage() {
  const router = useRouter();
  const { token, loading, profile, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK || "";

  const onboardingStatus = useMemo(() => String(status || profile?.onboarding_status || "NOT_STARTED"), [status, profile]);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (onboardingStatus === "VERIFIED") {
      router.replace("/dashboard");
      return;
    }
    if (onboardingStatus !== "PENDING_CALL") {
      router.replace("/onboard/step-6");
    }
  }, [loading, token, onboardingStatus, router]);

  useEffect(() => {
    let timer: number | undefined;
    let active = true;

    async function poll() {
      // Poll profile status until the backend flips to VERIFIED.
      setChecking(true);
      try {
        const details = await fetchProfileDetails();
        if (!active) return;
        const nextStatus = String(details.onboarding_status || details.onboarding?.state || "NOT_STARTED");
        setStatus(nextStatus);
        setLastCheckedAt(new Date());
        if (nextStatus === "VERIFIED") {
          await refreshProfile();
          router.replace("/dashboard");
        }
      } catch {
        // keep silent; next poll will retry
      } finally {
        if (active) setChecking(false);
      }
    }

    if (token) {
      void poll();
      timer = window.setInterval(poll, POLL_INTERVAL_MS);
    }

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [token, refreshProfile, router]);

  if (loading || !token) return <LoadingScreen />;

  return (
    <OnboardingShell title="Verification pending" subtitle="We will notify you once verification is complete." activeStep={6}>
      <div className="card form-card">
        <h2 style={{ marginTop: 0 }}>Waiting for verification</h2>
        <p className="hero-subtitle" style={{ marginBottom: 12 }}>
          Your call has been scheduled. We will verify your information after the call and activate your account.
        </p>
        <div className="status-pill" role="status" aria-live="polite">
          Status: {onboardingStatus}
        </div>
        <p className="hero-subtitle" style={{ marginTop: 8 }}>
          {checking ? "Checking for updates..." : "We check automatically every few seconds."}
        </p>
        {lastCheckedAt && (
          <p className="hero-subtitle" style={{ marginTop: 6 }}>
            Last checked: {lastCheckedAt.toLocaleTimeString()}
          </p>
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          <button
            type="button"
            className="button button-secondary"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                const details = await fetchProfileDetails();
                const nextStatus = String(details.onboarding_status || details.onboarding?.state || "NOT_STARTED");
                setStatus(nextStatus);
                setLastCheckedAt(new Date());
                if (nextStatus === "VERIFIED") {
                  await refreshProfile();
                  router.replace("/dashboard");
                }
              } finally {
                setChecking(false);
              }
            }}
          >
            Check now
          </button>
          {calLink && (
            <a className="button" href={calLink} target="_blank" rel="noreferrer">
              Reschedule call
            </a>
          )}
          {!calLink && (
            <button type="button" className="button" onClick={() => router.push("/onboard/step-6")}>
              Back to scheduling
            </button>
          )}
        </div>
        <div style={{ marginTop: 18 }}>
          <p className="section-title">What happens next</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-muted)" }}>
            <li>We review your call and submitted documents.</li>
            <li>Once verified, your dashboard unlocks automatically.</li>
            <li>If you need to reschedule, use the link above.</li>
          </ul>
        </div>
      </div>
    </OnboardingShell>
  );
}
