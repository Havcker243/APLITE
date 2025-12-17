import React from "react";

const STEPS = [
  { id: 1, label: "Business" },
  { id: 2, label: "Authority" },
  { id: 3, label: "Identity" },
  { id: 4, label: "Bank" },
  { id: 5, label: "Verify" },
];

export function OnboardingStepper({
  currentStep,
  completedThrough,
  onStepClick,
}: {
  currentStep: number;
  completedThrough: number;
  onStepClick?: (step: number) => void;
}) {
  return (
    <div className="onboarding-stepper" aria-label="Onboarding progress">
      {STEPS.map((step) => {
        const completed = completedThrough >= step.id;
        const current = currentStep === step.id;
        const clickable = typeof onStepClick === "function" && step.id <= Math.max(currentStep, completedThrough);

        return (
          <button
            key={step.id}
            type="button"
            className={`step${completed ? " step--complete" : ""}${current ? " step--current" : ""}`}
            onClick={() => clickable && onStepClick?.(step.id)}
            disabled={!clickable}
            aria-current={current ? "step" : undefined}
          >
            <div className="step-circle" aria-hidden="true">
              {completed ? "✓" : step.id}
            </div>
            <div className="step-label">{`Stage ${step.id}: ${step.label}`}</div>
          </button>
        );
      })}
    </div>
  );
}

