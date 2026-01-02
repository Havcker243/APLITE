/**
 * Shared shell layout for onboarding steps.
 * Provides the step header, progress, and consistent page framing.
 */

import { useEffect } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, Shield } from "lucide-react";

import { OnboardingStepper } from "../OnboardingStepper";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { useAuth } from "../../utils/auth";

function stepPath(step: number) {
  if (step <= 1) return "/onboard/step-1";
  if (step === 2) return "/onboard/step-2";
  if (step === 3) return "/onboard/step-3";
  if (step === 4) return "/onboard/step-4";
  if (step === 5) return "/onboard/step-5";
  return "/onboard/step-6";
}

export function OnboardingShell({
  activeStep,
  children,
}: {
  activeStep: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile } = useAuth();
  const { completedThrough } = useOnboardingWizard();
  const previousStep = Math.max(1, activeStep - 1);

  useEffect(() => {
    // If already verified, do not allow re-entering onboarding flow.
    if (profile?.onboarding_status === "VERIFIED") {
      router.replace("/dashboard");
    }
  }, [profile, router]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (activeStep <= 1) {
                  router.push("/dashboard");
                } else {
                  router.push(stepPath(previousStep));
                }
              }}
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Shield className="h-6 w-6" />
              <span className="font-semibold">Aplite</span>
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="max-w-4xl mx-auto">
            <OnboardingStepper
              currentStep={activeStep}
              completedThrough={completedThrough}
              onStepClick={(step) => {
                // Allow backwards navigation only through completed steps.
                if (step <= activeStep) router.push(stepPath(step));
              }}
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-xl mx-auto">{children}</div>
      </div>
    </div>
  );
}
