/**
 * Onboarding progress indicator component.
 * Shows current step and completion state across the onboarding flow.
 */

import { Building2, Calendar, CheckCircle2, CreditCard, FileText, User } from "lucide-react";
import { cn } from "../utils/cn";

const STEPS = [
  { id: 1, label: "Business", icon: Building2 },
  { id: 2, label: "Authority", icon: User },
  { id: 3, label: "Identity", icon: FileText },
  { id: 4, label: "Bank", icon: CreditCard },
  { id: 5, label: "Review", icon: CheckCircle2 },
  { id: 6, label: "Verify", icon: Calendar },
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
    <div className="flex items-center justify-between" aria-label="Onboarding progress">
      {STEPS.map((step, index) => {
        const current = currentStep === step.id;
        const passed = currentStep > step.id;
        const clickable = typeof onStepClick === "function" && step.id <= Math.max(currentStep, completedThrough);

        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              className={cn("flex flex-col items-center text-center", !clickable && "cursor-not-allowed")}
              onClick={() => {
                if (clickable) onStepClick?.(step.id);
              }}
              disabled={!clickable}
              aria-current={current ? "step" : undefined}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  current
                    ? "bg-primary text-primary-foreground"
                    : passed
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {passed ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              <span
                className={cn(
                  "text-xs mt-2 hidden md:block",
                  current ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <div className={cn("w-8 md:w-16 h-0.5 mx-2", passed ? "bg-success" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
