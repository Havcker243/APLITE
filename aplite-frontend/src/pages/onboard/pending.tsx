/**
 * Onboarding pending status page.
 * Explains next steps while verification is in review.
 */

﻿import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Calendar, Clock, XCircle } from "lucide-react";
import { getCalApi } from "@calcom/embed-react";

import DashboardLayout from "../../components/DashboardLayout";
import { LoadingScreen } from "../../components/LoadingScreen";
import { onboardingReset } from "../../utils/api";
import { useAuth } from "../../utils/auth";
import { Button } from "../../components/ui/button";

const POLL_INTERVAL_MS = 8000;

export default function OnboardPendingPage() {
  const router = useRouter();
  const { token, loading, profile, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState<string>("");
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK || "";

  // Use local poll result if present; otherwise fall back to auth profile snapshot.
  const onboardingStatus = useMemo(() => String(status || profile?.onboarding_status || "NOT_STARTED"), [status, profile]);
  const rejectionReason = reviewReason || profile?.verification_review?.reason || "";

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
    if (onboardingStatus === "REJECTED") {
      return;
    }
    if (onboardingStatus !== "PENDING_CALL" && onboardingStatus !== "PENDING_REVIEW") {
      router.replace("/onboard");
    }
  }, [loading, token, onboardingStatus, router]);

  useEffect(() => {
    if (!calLink) return;
    // Initialize Cal embed only when the link is configured.
    (async function initCal() {
      const cal = await getCalApi({ namespace: "30min" });
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    })();
  }, [calLink]);

  useEffect(() => {
    let timer: number | undefined;
    let active = true;

    async function poll() {
      // Poll the profile snapshot to see if admin has verified or rejected.
      setChecking(true);
      try {
        const details = await refreshProfile();
        if (!details) return;
        if (!active) return;
        const nextStatus = String(details.onboarding_status || details.onboarding?.state || "NOT_STARTED");
        setStatus(nextStatus);
        setReviewReason(details.verification_review?.reason || "");
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

  async function handleRestart() {
    try {
      await onboardingReset();
      await refreshProfile();
      router.push("/onboard");
    } catch {
      // ignore
    }
  }

  if (loading || !token) return <LoadingScreen />;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-6">
            {onboardingStatus === "REJECTED" ? (
              <XCircle className="h-10 w-10 text-destructive" />
            ) : (
              <Clock className="h-10 w-10 text-warning" />
            )}
          </div>
          
          <h1 className="text-2xl font-semibold text-foreground mb-3">
            {onboardingStatus === "REJECTED" ? "Verification Rejected" : "Awaiting Verification"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {onboardingStatus === "REJECTED"
              ? "Your verification was rejected. Review the reason and resubmit."
              : "Your onboarding is complete. Our team is reviewing your submission."}
          </p>

          <div className="space-y-3">
            {onboardingStatus === "PENDING_CALL" && (
              <>
                {calLink ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    data-cal-namespace="30min"
                    data-cal-link={calLink}
                    data-cal-config='{"layout":"month_view"}'
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Reschedule Call
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => router.push("/onboard/step-6")}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Call
                  </Button>
                )}
              </>
            )}
            {onboardingStatus === "REJECTED" && (
              <>
                {rejectionReason && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive text-left">
                    {rejectionReason}
                  </div>
                )}
                <Button variant="hero" className="w-full" onClick={handleRestart}>
                  Restart onboarding
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
