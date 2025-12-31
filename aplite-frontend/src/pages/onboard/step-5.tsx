/**
 * Onboarding step 5: review and attestation.
 * Shows a summary of captured data before final submission.
 */

import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/router";

import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { useAuth } from "../../utils/auth";
import { useOnboardingWizard } from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";
import { onboardingComplete } from "../../utils/api";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export default function OnboardStep5() {
  const router = useRouter();
  const { token, loading, refreshProfile, profile } = useAuth();
  const { step1, step2, step3, step4, completedThrough, clearDraft, touchStep, markStepComplete } = useOnboardingWizard();

  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingCall, setPendingCall] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const status = String(profile?.onboarding_status || "");
    if (status === "PENDING_CALL") {
      setPendingCall(true);
    }
    if (status === "PENDING_REVIEW") {
      setPendingReview(true);
    }
  }, [profile]);

  useEffect(() => {
    touchStep(5);
    if (completedThrough < 4) {
      router.replace(
        completedThrough < 1
          ? "/onboard/step-1"
          : completedThrough === 1
          ? "/onboard/step-2"
          : completedThrough === 2
          ? "/onboard/step-3"
          : "/onboard/step-4"
      );
    }
  }, [touchStep, completedThrough, router]);

  const maskedAccount = useMemo(() => {
    if (!step4.account_number) return "";
    const last4 = step4.account_number.slice(-4);
    return `**** ${last4}`;
  }, [step4.account_number]);

  // Keep verification method in sync with backend expectations.
  const verificationMethod = step2.role === "owner" ? "call" : "id";

  if (loading || !token || !mounted) return <LoadingScreen />;

  async function handleSubmit() {
    setSaving(true);
    try {
      const industry = step1.industry === "Other" ? step1.industry_other : step1.industry;
      if (step1.industry === "Other" && !step1.industry_other.trim()) {
        throw new Error("Industry is required. Select an industry or specify Other.");
      }
      if (!step2.role) throw new Error("Select your role on Step 2.");
      if (!step3.attestation) throw new Error("Attestation required on Step 3.");
      if (!step4.bank_name || !step4.account_number) throw new Error("Bank details are required on Step 4.");

      // Build payload from local drafts; backend receives full snapshot in one request.
      const file = step3.file || null;
      const payload = {
        org: {
          legal_name: step1.legal_name,
          dba: step1.dba || undefined,
          ein: step1.ein,
          formation_date: step1.formation_date,
          formation_state: step1.formation_state,
          entity_type: step1.entity_type,
          formation_documents: step1.formation_documents
            .filter((doc) => doc.file_id)
            .map((doc) => ({ doc_type: doc.doc_type, file_id: doc.file_id as string })),
          address: {
            street1: step1.street1,
            street2: step1.street2 || undefined,
            city: step1.city,
            state: step1.state,
            zip: step1.zip,
            country: step1.country,
          },
          industry,
          website: step1.website || undefined,
          description: step1.description || undefined,
        },
        role: {
          role: step2.role as "owner" | "authorized_rep",
          title: step2.title || undefined,
        },
        identity: {
          full_name: step3.full_name,
          title: step3.title || undefined,
          id_document_id: step3.file_id || undefined,
          phone: step3.phone || undefined,
          attestation: step3.attestation,
        },
        bank: {
          bank_name: step4.bank_name,
          account_number: step4.account_number,
          ach_routing: step4.ach_routing || undefined,
          wire_routing: step4.wire_routing || undefined,
          swift: step4.swift || undefined,
        },
        verification_method: verificationMethod,
        file,
      };

      const res = await onboardingComplete(payload);
      await refreshProfile();
      markStepComplete(5);
      // Route based on backend state so UI reflects admin-driven verification.
      if (res.status === "PENDING_CALL") {
        setPendingCall(true);
        toast.success("Submitted. Please schedule your verification call.");
        router.push("/onboard/step-6");
        return;
      }
      if (res.status === "PENDING_REVIEW") {
        setPendingReview(true);
        toast.success("Submitted. Your verification is under review.");
        router.push("/onboard/pending");
        return;
      }
      clearDraft();
      toast.success(`Verified. Issued UPI: ${res.upi}`);
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to complete onboarding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingShell activeStep={5}>
      {pendingCall && (
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-sm text-warning" role="status" aria-live="polite">
          Verification pending. Schedule your call on the next step.
        </div>
      )}
      {pendingReview && (
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-sm text-warning" role="status" aria-live="polite">
          Verification pending. Your submission is under review.
        </div>
      )}

      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Review & Submit</h2>
          <p className="text-muted-foreground">Review your information before submitting.</p>
        </div>

        <div className="space-y-4">
          <ReviewSection title="Business identity">
            <ReviewItem label="Legal name" value={step1.legal_name || "-"} />
            {step1.dba && <ReviewItem label="DBA" value={step1.dba} />}
            <ReviewItem label="EIN" value={step1.ein || "-"} />
            <ReviewItem
              label="Entity"
              value={`${step1.entity_type || "-"} - ${step1.formation_state || "-"} - ${step1.formation_date || "-"}`}
            />
            <ReviewItem
              label="Address"
              value={[step1.street1, step1.street2, step1.city, step1.state, step1.zip, step1.country]
                .filter(Boolean)
                .join(", ")}
            />
            <ReviewItem
              label="Industry"
              value={step1.industry === "Other" ? step1.industry_other || "Other" : step1.industry || "-"}
            />
            {step1.website && <ReviewItem label="Website" value={step1.website} />}
            {step1.description && <ReviewItem label="Description" value={step1.description} />}
            {step1.formation_documents.length > 0 && (
              <ReviewItem
                label="Formation documents"
                value={
                  step1.formation_documents
                    .filter((doc) => doc.file_id)
                    .map((doc) => doc.doc_type.replace(/_/g, " "))
                    .join(", ") || "-"
                }
              />
            )}
          </ReviewSection>

          <ReviewSection title="Authority">
            <ReviewItem label="Role" value={`${step2.role || "-"}${step2.title ? ` - ${step2.title}` : ""}`} />
          </ReviewSection>

          <ReviewSection title="Identity">
            <ReviewItem label="Name" value={step3.full_name || "-"} />
            <ReviewItem label="Phone" value={step3.phone || "-"} />
            {verificationMethod !== "call" && (
              <ReviewItem
                label="ID document"
                value={step3.file_id ? `Uploaded (${step3.file_id})` : step3.file ? step3.file.name : "Not provided"}
              />
            )}
            <ReviewItem label="Attestation" value={step3.attestation ? "Yes" : "No"} />
          </ReviewSection>

          <ReviewSection title="Bank details">
            <ReviewItem label="Bank name" value={step4.bank_name || "-"} />
            <ReviewItem label="Account number" value={maskedAccount || "-"} />
            <ReviewItem label="ACH routing" value={step4.ach_routing || "-"} />
            <ReviewItem label="Wire routing" value={step4.wire_routing || "-"} />
            <ReviewItem label="SWIFT/BIC" value={step4.swift || "-"} />
          </ReviewSection>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button type="button" variant="outline" onClick={() => router.push("/onboard/step-4")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="button" variant="success" onClick={handleSubmit} disabled={saving || pendingCall || pendingReview}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pendingCall || pendingReview ? "Pending verification" : "Submit for verification"}
          </Button>
        </div>
      </div>
    </OnboardingShell>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-muted/50 border-b border-border">
        <h3 className="font-medium text-foreground">{title}</h3>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  const displayValue = value && value.trim().length > 0 ? value : "-";
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right max-w-[60%]">{displayValue}</span>
    </div>
  );
}
