import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";

function stepPath(step: number) {
  if (step <= 1) return "/onboard/step-1";
  if (step === 2) return "/onboard/step-2";
  if (step === 3) return "/onboard/step-3";
  if (step === 4) return "/onboard/step-4";
  if (step === 5) return "/onboard/step-5";
  return "/onboard/step-6";
}

export default function OnboardIndex() {
  const router = useRouter();
  const { token, loading, profile } = useAuth();
  const { currentStep, refreshSession } = useOnboardingWizard();

  useEffect(() => {
    if (loading) return;
    if (!token) return;
    const status = String(profile?.onboarding_status || "NOT_STARTED");
    if (status === "VERIFIED") {
      router.replace("/dashboard");
      return;
    }
    if (status === "PENDING_CALL") {
      router.replace("/onboard/step-6");
      return;
    }
    let cancelled = false;

    (async () => {
      const step = await refreshSession();
      if (!cancelled) {
        router.replace(stepPath(step ?? currentStep));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, token, profile, currentStep, refreshSession, router]);

  if (loading) return <LoadingScreen />;
  if (!token) return <LoadingScreen />;
  return <LoadingScreen label="Loading onboarding..." />;
}
