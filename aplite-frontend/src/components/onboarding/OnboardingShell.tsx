import React from "react";
import { useRouter } from "next/router";
import { OnboardingStepper } from "../OnboardingStepper";
import { useOnboardingWizard } from "../../utils/onboardingWizard";

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
  const { completedThrough } = useOnboardingWizard();

  return (
    <div className="page-container onboarding-container">
      <section className="hero" style={{ marginBottom: 10 }}>
        <div>
          <p className="section-title">Onboarding</p>
          <h1 className="hero-title">{title}</h1>
          <p className="hero-subtitle">{subtitle}</p>
        </div>
      </section>

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
