/**
 * Onboarding step 3: identity verification details.
 * Collects full name, phone, and an ID document upload.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, ArrowRight, Loader2, Upload } from "lucide-react";

import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { onboardingSaveDraft, onboardingUploadId } from "../../utils/api";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { toastApiError } from "../../utils/notifications";

export default function OnboardStep3() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const { step3, setStep3, step2, completedThrough, touchStep, markStepComplete } = useOnboardingWizard();

  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const role = useMemo(() => (step2.role as "owner" | "authorized_rep" | undefined) || "", [step2.role]);
  const callBased = role === "owner";
  const requiresIdUpload = role === "authorized_rep";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    touchStep(3);
  }, [touchStep]);

  useEffect(() => {
    if (!mounted) return;
    if (completedThrough < 2) {
      router.replace(completedThrough < 1 ? "/onboard/step-1" : "/onboard/step-2");
    }
  }, [mounted, completedThrough, router]);

  if (loading || !token || !mounted) return <LoadingScreen />;

  async function handleSubmit(e: React.FormEvent) {
    /** Upload ID if needed, save Step 3 draft, then advance. */
    e.preventDefault();
    setSaving(true);
    try {
      let fileId = step3.file_id;
      let storageHint: string | null = null;
      if (requiresIdUpload && !fileId) {
        if (!step3.file) throw new Error("Upload a government ID document (jpg, png, or pdf).");
        const res = await onboardingUploadId(step3.file);
        fileId = res.file_id;
        storageHint = res.storage ? `Uploaded (${res.storage === "s3" ? "cloud" : res.storage})` : "Uploaded";
        setStep3((prev) => ({ ...prev, file_id: fileId }));
      }

      await onboardingSaveDraft({
        step: 3,
        completed: true,
        data: {
          full_name: step3.full_name,
          title: step3.title || undefined,
          id_document_id: fileId || undefined,
          phone: step3.phone || undefined,
          attestation: step3.attestation,
        },
      });
      toast.success(storageHint || "Saved");
      markStepComplete(3);
      router.push("/onboard/step-4");
    } catch (err) {
      toastApiError(err, "Unable to save step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingShell activeStep={3}>
      <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Identity</h2>
          <p className="text-muted-foreground">
            {callBased
              ? "Provide your personal information. Owners complete verification via a call."
              : "Provide your personal information and upload a government ID."}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full legal name *</Label>
            <Input id="full_name" value={step3.full_name} onChange={(e) => setStep3((p) => ({ ...p, full_name: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="person_title">Title *</Label>
            <Input
              id="person_title"
              value={step3.title}
              onChange={(e) => setStep3((p) => ({ ...p, title: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              value={step3.phone}
              onChange={(e) => setStep3((p) => ({ ...p, phone: e.target.value }))}
              required
            />
          </div>

          {requiresIdUpload && (
            <div className="space-y-2">
              <Label htmlFor="id_file">Government ID *</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Input
                  id="id_file"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setStep3((p) => ({ ...p, file, file_id: undefined }));
                  }}
                  required={!step3.file_id}
                />
                <label htmlFor="id_file" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm">{step3.file?.name || step3.file_id || "Upload ID document"}</p>
                </label>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Checkbox
              id="attestation"
              checked={step3.attestation}
              onCheckedChange={(checked) => setStep3((p) => ({ ...p, attestation: Boolean(checked) }))}
            />
            <Label htmlFor="attestation" className="cursor-pointer text-sm">
              I attest that all information provided is accurate and I am authorized to submit this application.
            </Label>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button type="button" variant="outline" onClick={() => router.push("/onboard/step-2")}>
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
