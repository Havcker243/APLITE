import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";

function stepPath(step: number) {
  if (step <= 1) return "/onboard/step-1";
  if (step === 2) return "/onboard/step-2";
  if (step === 3) return "/onboard/step-3";
  if (step === 4) return "/onboard/step-4";
  return "/onboard/verify";
}

export default function OnboardIndex() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const { currentStep, refreshSession } = useOnboardingWizard();

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/signup?next=/onboard");
      return;
    }
    void refreshSession().finally(() => {
      router.replace(stepPath(currentStep));
    });
  }, [ready, token, router, refreshSession, currentStep]);

  return null;
}

