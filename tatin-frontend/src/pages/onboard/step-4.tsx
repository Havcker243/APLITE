/**
 * Onboarding step 4: bank rail and account details.
 * Captures routing/account numbers used for payment accounts.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { useAuth } from "../../utils/auth";
import { normalizeRouting, useOnboardingWizard } from "../../utils/onboardingWizard";
import { onboardingSaveDraft } from "../../utils/api";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";
import { toastApiError } from "../../utils/notifications";

export default function OnboardStep4() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const { step4, setStep4, completedThrough, touchStep, markStepComplete } = useOnboardingWizard();

  const [railType, setRailType] = useState<"ACH" | "WIRE_DOM" | "SWIFT">("ACH");

  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (step4.swift) {
      setRailType("SWIFT");
    } else if (step4.wire_routing) {
      setRailType("WIRE_DOM");
    } else {
      setRailType("ACH");
    }
  }, [step4.swift, step4.wire_routing]);

  useEffect(() => {
    touchStep(4);
  }, [touchStep]);

  useEffect(() => {
    if (!mounted) return;
    if (completedThrough < 3) {
      router.replace(
        completedThrough < 1
          ? "/onboard/step-1"
          : completedThrough === 1
          ? "/onboard/step-2"
          : "/onboard/step-3"
      );
    }
  }, [mounted, completedThrough, router]);

  if (loading || !token || !mounted) return <LoadingScreen />;

  async function handleSubmit(e: React.FormEvent) {
    /** Save bank rail details and advance to review. */
    e.preventDefault();
    setSaving(true);
    try {
      await onboardingSaveDraft({
        step: 4,
        completed: true,
        data: {
          bank_name: step4.bank_name,
          account_number: step4.account_number,
          ach_routing: railType === "ACH" ? step4.ach_routing || undefined : undefined,
          wire_routing: railType === "WIRE_DOM" ? step4.wire_routing || undefined : undefined,
          swift: railType === "SWIFT" ? step4.swift || undefined : undefined,
        },
      });
      toast.success("Saved");
      markStepComplete(4);
      router.push("/onboard/step-5");
    } catch (err) {
      toastApiError(err, "Unable to save step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingShell activeStep={4}>
      <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Bank Rails</h2>
          <p className="text-muted-foreground">Add your payout account.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bank_name">Bank name *</Label>
            <Input
              id="bank_name"
              value={step4.bank_name}
              onChange={(e) => setStep4((p) => ({ ...p, bank_name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_number">Account number *</Label>
            <Input
              id="account_number"
              className="font-mono"
              value={step4.account_number}
              onChange={(e) =>
                setStep4((p) => ({
                  ...p,
                  account_number:
                    railType === "SWIFT"
                      ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 34)
                      : normalizeRouting(e.target.value, 32),
                }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Rail type *</Label>
            <Select value={railType} onValueChange={(value) => setRailType(value as "ACH" | "WIRE_DOM" | "SWIFT")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACH">ACH</SelectItem>
                <SelectItem value="WIRE_DOM">Wire</SelectItem>
                <SelectItem value="SWIFT">SWIFT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {railType !== "SWIFT" && (
            <div className="space-y-2">
              <Label htmlFor="ach_routing">Routing number *</Label>
              <Input
                id="ach_routing"
                className="font-mono"
                value={railType === "WIRE_DOM" ? step4.wire_routing : step4.ach_routing}
                onChange={(e) =>
                  setStep4((p) => ({
                    ...p,
                    ach_routing: railType === "WIRE_DOM" ? p.ach_routing : normalizeRouting(e.target.value, 9),
                    wire_routing: railType === "WIRE_DOM" ? normalizeRouting(e.target.value, 34) : p.wire_routing,
                  }))
                }
                placeholder={railType === "WIRE_DOM" ? "Wire routing" : "ACH routing"}
                required
              />
            </div>
          )}

          {railType === "SWIFT" && (
            <div className="space-y-2">
              <Label htmlFor="swift">SWIFT code *</Label>
              <Input
                id="swift"
                className="font-mono"
                value={step4.swift}
                onChange={(e) =>
                  setStep4((p) => ({
                    ...p,
                    swift: e.target.value.toUpperCase().replace(/\s/g, ""),
                  }))
                }
                placeholder="8 or 11 chars"
                required
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button type="button" variant="outline" onClick={() => router.push("/onboard/step-3")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" variant="hero" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
