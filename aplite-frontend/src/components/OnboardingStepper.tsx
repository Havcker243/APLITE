import React from "react";

const STEPS = [
  { id: 1, label: "Business" },
  { id: 2, label: "Authority" },
  { id: 3, label: "Identity" },
  { id: 4, label: "Bank" },
  { id: 5, label: "Verify" },
];

export function OnboardingStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="onboarding-stepper" aria-label="Onboarding progress">
      {STEPS.map((step) => {
        const completed = currentStep > step.id;
        const current = currentStep === step.id;
        return (
          <div key={step.id} className={`step${completed ? " step--complete" : ""}${current ? " step--current" : ""}`}>
            <div className="step-circle" aria-hidden="true">
              {completed ? "✓" : step.id}
            </div>
            <div className="step-label">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}

