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
  return "/onboard/verify";
}

export default function OnboardIndex() {
  const router = useRouter();
  const { token, ready, accessLevel, profileReady } = useAuth();
  const { currentStep, refreshSession } = useOnboardingWizard();

  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    if (profileReady && accessLevel !== "ONBOARDING") {
      router.replace("/dashboard");
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
  }, [ready, token, profileReady, accessLevel]);

  if (!ready || !profileReady) return <LoadingScreen />;
  if (!token) return <LoadingScreen />;
  return <LoadingScreen label="Loading onboarding..." />;
}
