/**
 * Onboarding step 2: role and title selection.
 * Captures the user's role in the organization for risk review.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { onboardingSaveDraft } from "../../utils/api";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";

export default function OnboardStep2() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const { step2, setStep2, completedThrough, touchStep, markStepComplete } = useOnboardingWizard();

  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    touchStep(2);
    if (completedThrough < 1) {
      router.replace("/onboard/step-1");
    }
  }, [touchStep, completedThrough, router]);

  if (loading || !token || !mounted) return <LoadingScreen />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!step2.role) throw new Error("Select your role to continue.");
      await onboardingSaveDraft({
        step: 2,
        completed: true,
        data: {
          role: step2.role,
          title: step2.title || undefined,
        },
      });
      toast.success("Saved");
      markStepComplete(2);
      router.push("/onboard/step-3");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingShell activeStep={2}>
      <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Authority</h2>
          <p className="text-muted-foreground">Confirm your relationship with the business.</p>
        </div>

        <div className="space-y-4">
          <label
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer ${
              step2.role === "owner" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <input
              type="radio"
              checked={step2.role === "owner"}
              onChange={() => setStep2((p) => ({ ...p, role: "owner", title: "" }))}
            />
            <div>
              <p className="font-medium">Owner</p>
              <p className="text-sm text-muted-foreground">I am the owner of this business.</p>
            </div>
          </label>
          <label
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer ${
              step2.role === "authorized_rep" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <input
              type="radio"
              checked={step2.role === "authorized_rep"}
              onChange={() => setStep2((p) => ({ ...p, role: "authorized_rep" }))}
            />
            <div>
              <p className="font-medium">Authorized Representative</p>
              <p className="text-sm text-muted-foreground">I am authorized to act on behalf of the owner.</p>
            </div>
          </label>

          {step2.role === "authorized_rep" && (
            <div className="space-y-2 animate-fade-in">
              <Label htmlFor="title">Executive title *</Label>
              <Input
                id="title"
                placeholder="CEO, CFO, etc."
                value={step2.title}
                onChange={(event) => setStep2((p) => ({ ...p, title: event.target.value }))}
                required
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button type="button" variant="outline" onClick={() => router.push("/onboard/step-1")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" variant="hero" disabled={saving}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
