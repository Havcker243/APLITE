/**
 * Onboarding step 6: schedule verification call.
 * Embeds Cal.com scheduling and blocks exit until confirmed.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Calendar } from "lucide-react";
import { getCalApi } from "@calcom/embed-react";
import { toast } from "sonner";

import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";

export default function OnboardStep6() {
  const router = useRouter();
  const { token, loading, profile } = useAuth();
  const { completedThrough, touchStep, markStepComplete } = useOnboardingWizard();

  const [mounted, setMounted] = useState(false);
  const [callScheduled, setCallScheduled] = useState(false);

  const onboardingStatus = useMemo(() => String(profile?.onboarding_status || "NOT_STARTED"), [profile]);
  const needsCall = onboardingStatus === "PENDING_CALL";
  const shouldBlockExit = needsCall && !callScheduled;

  const calLink = process.env.NEXT_PUBLIC_CAL_LINK || "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!calLink) return;
    (async function initCal() {
      const cal = await getCalApi({ namespace: "30min" });
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    })();
  }, [calLink]);

  useEffect(() => {
    if (!shouldBlockExit) return;

    const handleRouteChangeStart = () => {
      toast.error("Please confirm you scheduled your verification call to continue.");
      router.events.emit("routeChangeError");
      throw new Error("Route change aborted.");
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    router.events.on("routeChangeStart", handleRouteChangeStart);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      router.events.off("routeChangeStart", handleRouteChangeStart);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [router.events, shouldBlockExit]);

  useEffect(() => {
    touchStep(6);
    if (onboardingStatus === "PENDING_REVIEW" || onboardingStatus === "REJECTED") {
      router.replace("/onboard/pending");
      return;
    }
    if (!needsCall && completedThrough < 5) {
      router.replace("/onboard/step-5");
    }
  }, [touchStep, completedThrough, needsCall, onboardingStatus, router]);

  useEffect(() => {
    if (callScheduled) {
      markStepComplete(6);
      router.push("/onboard/pending");
    }
  }, [callScheduled, markStepComplete, router]);

  if (loading || !token || !mounted) return <LoadingScreen />;

  if (onboardingStatus === "VERIFIED") {
    return (
      <OnboardingShell activeStep={6}>
        <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-sm text-success" role="status" aria-live="polite">
          Verified. You can continue to your dashboard.
        </div>
        <Button variant="hero" onClick={() => router.push("/dashboard")}>
          Go to dashboard
        </Button>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell activeStep={6}>
      {needsCall ? (
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-sm text-warning" role="status" aria-live="polite">
          Verification pending. Book or reschedule your call below.
        </div>
      ) : (
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-sm text-warning" role="status" aria-live="polite">
          Almost there. Schedule your verification call to proceed.
        </div>
      )}

      {callScheduled && (
        <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-sm text-success" role="status" aria-live="polite">
          Call scheduled. Watch for the calendar invite in your inbox.
        </div>
      )}

      <div className="space-y-6 animate-fade-in text-center">
        <Calendar className="h-16 w-16 mx-auto text-accent" />
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Schedule Verification Call</h2>
          <p className="text-muted-foreground">
            As a business owner, we need to verify your identity with a short call.
          </p>
        </div>
        <Button
          variant="hero"
          size="lg"
          disabled={!calLink}
          data-cal-namespace="30min"
          data-cal-link={calLink}
          data-cal-config='{"layout":"month_view"}'
        >
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Call
        </Button>
        {!calLink && (
          <p className="text-xs text-muted-foreground">
            Cal.com booking is not configured. Set `NEXT_PUBLIC_CAL_LINK`.
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Checkbox
            id="scheduled"
            checked={callScheduled}
            onCheckedChange={(checked) => setCallScheduled(Boolean(checked))}
          />
          <Label htmlFor="scheduled" className="text-sm text-muted-foreground">
            I scheduled my verification call
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Check the box after you finish scheduling to continue.
        </p>
      </div>
    </OnboardingShell>
  );
}
