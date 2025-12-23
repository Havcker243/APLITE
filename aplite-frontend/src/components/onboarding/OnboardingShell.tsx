import React from "react";
import { useRouter } from "next/router";
import { OnboardingStepper } from "../OnboardingStepper";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { useAuth } from "../../utils/auth";

function stepPath(step: number) {
  if (step <= 1) return "/onboard/step-1";
  if (step === 2) return "/onboard/step-2";
  if (step === 3) return "/onboard/step-3";
  if (step === 4) return "/onboard/step-4";
  return "/onboard/verify";
}

export function OnboardingShell({
  title,
  subtitle,
  activeStep,
  children,
}: {
  title: string;
  subtitle: string;
  activeStep: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile } = useAuth();
  const { completedThrough } = useOnboardingWizard();

  React.useEffect(() => {
    if (profile?.onboarding_status === "VERIFIED") {
      router.replace("/dashboard");
    }
  }, [profile, router]);

  return (
    <div className="page-container onboarding-container">
      <section className="hero" style={{ marginBottom: 10 }}>
        <div>
          <p className="section-title">Onboarding</p>
          <h1 className="hero-title">{title}</h1>
          <p className="hero-subtitle">{subtitle}</p>
        </div>
      </section>

      <div
        style={{
          marginBottom: 12,
          padding: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          background: "rgba(255,255,255,0.02)",
          color: "var(--text-secondary, #B8BCC6)",
          fontSize: "0.95rem",
        }}
      >
        Onboarding must be completed in one session. If you leave or log out before finishing, you will restart from Step 1 next time.
      </div>

      <OnboardingStepper
        currentStep={activeStep}
        completedThrough={completedThrough}
        onStepClick={(step) => {
          if (step <= activeStep) router.push(stepPath(step));
        }}
      />

      {children}
    </div>
  );
}
