/**
 * Onboarding step 1: organization details and formation docs.
 * Collects legal info, address, and optional documentation uploads.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ArrowRight, Loader2 } from "lucide-react";

import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { useAuth } from "../../utils/auth";
import { onboardingSaveDraft, onboardingUploadFormation } from "../../utils/api";
import { COUNTRIES, isCanada, isUnitedStates, US_STATES, CA_PROVINCES } from "../../utils/geo";
import { FormationDocType, normalizeEIN, useOnboardingWizard } from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";

const FORMATION_DOCS: Record<
  string,
  { required: boolean; options: Array<{ type: FormationDocType; label: string }> }
> = {
  LLC: {
    required: true,
    options: [
      { type: "articles_of_organization", label: "Articles of Organization / Certificate of Formation" },
    ],
  },
  "C-Corp": {
    required: true,
    options: [{ type: "articles_of_incorporation", label: "Articles of Incorporation" }],
  },
  "S-Corp": {
    required: true,
    options: [{ type: "articles_of_incorporation", label: "Articles of Incorporation" }],
  },
  "Non-Profit": {
    required: true,
    options: [{ type: "articles_of_incorporation", label: "Articles of Incorporation" }],
  },
  Partnership: {
    required: true,
    options: [
      { type: "certificate_of_limited_partnership", label: "Certificate of Limited Partnership" },
      { type: "partnership_equivalent", label: "Partnership Equivalent Document" },
    ],
  },
  "Sole Proprietor": {
    required: false,
    options: [],
  },
};

export default function OnboardStep1() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const {
    step1,
    setStep1,
    refreshSession,
    touchStep,
    markStepComplete,
  } = useOnboardingWizard();

  const [saving, setSaving] = useState(false);

  const bizIsUS = isUnitedStates(step1.country);
  const bizIsCA = isCanada(step1.country);
  const formationConfig = FORMATION_DOCS[step1.entity_type] || { required: false, options: [] };

  useEffect(() => {
    if (loading || !token) return;
    void refreshSession();
  }, [loading, token, refreshSession]);

  useEffect(() => {
    touchStep(1);
  }, [touchStep]);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  if (loading || !token) return <LoadingScreen />;

  function updateFormationDoc(docType: FormationDocType, updates: { file?: File; file_id?: string }) {
    setStep1((prev) => {
      const docs = prev.formation_documents || [];
      const idx = docs.findIndex((doc) => doc.doc_type === docType);
      const nextDocs = [...docs];
      if (idx >= 0) {
        nextDocs[idx] = { ...nextDocs[idx], ...updates, doc_type: docType };
      } else {
        nextDocs.push({ doc_type: docType, ...updates });
      }
      return { ...prev, formation_documents: nextDocs };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const industry = step1.industry === "Other" ? step1.industry_other : step1.industry;
      if (step1.industry === "Other" && !step1.industry_other.trim()) {
        throw new Error("Industry is required. Select an industry or specify Other.");
      }
      if (formationConfig.required) {
        const requiredTypes = formationConfig.options.map((opt) => opt.type);
        const provided = step1.formation_documents.filter((doc) => requiredTypes.includes(doc.doc_type));
        const hasAny = provided.some((doc) => Boolean(doc.file_id || doc.file));
        if (!hasAny) {
          throw new Error("Upload at least one valid formation document for this entity type.");
        }
        const updatedDocs = [...step1.formation_documents];
        for (const doc of provided) {
          if (doc.file && !doc.file_id) {
            const res = await onboardingUploadFormation(doc.file, doc.doc_type);
            updateFormationDoc(doc.doc_type, { file_id: res.file_id, file: undefined });
            const idx = updatedDocs.findIndex((item) => item.doc_type === doc.doc_type);
            if (idx >= 0) {
              updatedDocs[idx] = { ...updatedDocs[idx], file_id: res.file_id, file: undefined };
            }
          }
        }
        const formationDocs = updatedDocs
          .filter((doc) => Boolean(doc.file_id))
          .map((doc) => ({ doc_type: doc.doc_type, file_id: doc.file_id as string }));
        await onboardingSaveDraft({
          step: 1,
          completed: true,
          data: {
            legal_name: step1.legal_name,
            dba: step1.dba || undefined,
            ein: step1.ein,
            formation_date: step1.formation_date,
            formation_state: step1.formation_state,
            entity_type: step1.entity_type,
            formation_documents: formationDocs.length ? formationDocs : undefined,
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
        });
        toast.success("Saved");
        markStepComplete(1);
        router.push("/onboard/step-2");
        return;
      }
      const formationDocs = step1.formation_documents
        .filter((doc) => Boolean(doc.file_id))
        .map((doc) => ({ doc_type: doc.doc_type, file_id: doc.file_id as string }));
      await onboardingSaveDraft({
        step: 1,
        completed: true,
        data: {
          legal_name: step1.legal_name,
          dba: step1.dba || undefined,
          ein: step1.ein,
          formation_date: step1.formation_date,
          formation_state: step1.formation_state,
          entity_type: step1.entity_type,
          formation_documents: formationDocs.length ? formationDocs : undefined,
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
      });
      toast.success("Saved");
      markStepComplete(1);
      router.push("/onboard/step-2");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingShell activeStep={1}>
      <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Business Identity</h2>
          <p className="text-muted-foreground">Tell us about your business.</p>
        </div>

        <div className="space-y-6">
          <section className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="legal_name">Legal entity name *</Label>
              <Input id="legal_name" value={step1.legal_name} onChange={(e) => setStep1((p) => ({ ...p, legal_name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dba">DBA (optional)</Label>
              <Input id="dba" value={step1.dba} onChange={(e) => setStep1((p) => ({ ...p, dba: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_type">Business type *</Label>
              <Select
                value={step1.entity_type}
                onValueChange={(value) => setStep1((p) => ({ ...p, entity_type: value, formation_documents: [] }))}
              >
                <SelectTrigger id="entity_type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LLC">LLC</SelectItem>
                  <SelectItem value="C-Corp">Corporation</SelectItem>
                  <SelectItem value="S-Corp">S Corporation</SelectItem>
                  <SelectItem value="Partnership">Partnership</SelectItem>
                  <SelectItem value="Non-Profit">Non-Profit</SelectItem>
                  <SelectItem value="Sole Proprietor">Sole Proprietor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry *</Label>
              <Select value={step1.industry} onValueChange={(value) => setStep1((p) => ({ ...p, industry: value }))}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Software">Software</SelectItem>
                  <SelectItem value="Fintech">Fintech</SelectItem>
                  <SelectItem value="E-commerce">E-commerce</SelectItem>
                  <SelectItem value="Marketplace">Marketplace</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {step1.industry === "Other" && (
              <div className="space-y-2">
                <Label htmlFor="industry_other">Specify industry *</Label>
                <Input id="industry_other" value={step1.industry_other} onChange={(e) => setStep1((p) => ({ ...p, industry_other: e.target.value }))} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                list="countries"
                value={step1.country}
                onChange={(e) => setStep1((p) => ({ ...p, country: e.target.value, state: "", formation_state: "" }))}
                placeholder="United States"
                required
              />
              <datalist id="countries">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="street1">Address *</Label>
              <Textarea
                id="street1"
                rows={3}
                value={step1.street1}
                onChange={(e) => setStep1((p) => ({ ...p, street1: e.target.value }))}
                placeholder="Street, city, state, zip"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="street2">Address line 2 (optional)</Label>
              <Input id="street2" value={step1.street2} onChange={(e) => setStep1((p) => ({ ...p, street2: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input id="city" value={step1.city} onChange={(e) => setStep1((p) => ({ ...p, city: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State / Region *</Label>
              <Input
                id="state"
                list={bizIsUS ? "address-states-us" : bizIsCA ? "address-provinces-ca" : undefined}
                value={step1.state}
                onChange={(e) => setStep1((p) => ({ ...p, state: e.target.value }))}
                placeholder={bizIsUS ? "CA" : bizIsCA ? "ON" : "State / Region"}
                required
              />
              {bizIsUS && (
                <datalist id="address-states-us">
                  {US_STATES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
              {bizIsCA && (
                <datalist id="address-provinces-ca">
                  {CA_PROVINCES.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP *</Label>
              <Input id="zip" className="font-mono" value={step1.zip} onChange={(e) => setStep1((p) => ({ ...p, zip: e.target.value }))} placeholder="94105" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ein">EIN *</Label>
              <Input
                id="ein"
                className="font-mono"
                value={step1.ein}
                onChange={(e) => setStep1((p) => ({ ...p, ein: normalizeEIN(e.target.value) }))}
                placeholder="12-3456789"
                required
              />
              <p className="text-xs text-muted-foreground">Format: NN-NNNNNNN</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="formation_date">Formation date *</Label>
              <Input
                id="formation_date"
                type="date"
                value={step1.formation_date}
                max={today}
                onChange={(e) => setStep1((p) => ({ ...p, formation_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formation_state">Formation state *</Label>
              <Input
                id="formation_state"
                list={bizIsUS ? "formation-states-us" : bizIsCA ? "formation-provinces-ca" : undefined}
                value={step1.formation_state}
                onChange={(e) => setStep1((p) => ({ ...p, formation_state: e.target.value }))}
                placeholder={bizIsUS ? "CA" : bizIsCA ? "ON" : "State / Region"}
                required
              />
              {bizIsUS && (
                <datalist id="formation-states-us">
                  {US_STATES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
              {bizIsCA && (
                <datalist id="formation-provinces-ca">
                  {CA_PROVINCES.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website (optional)</Label>
              <Input id="website" type="url" value={step1.website} onChange={(e) => setStep1((p) => ({ ...p, website: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                rows={3}
                value={step1.description}
                onChange={(e) => setStep1((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          </section>

          {formationConfig.options.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Formation documents</h3>
              <p className="text-sm text-muted-foreground">Upload at least one of the acceptable documents below.</p>
              <div className="grid gap-4">
                {formationConfig.options.map((option) => {
                  const doc = step1.formation_documents.find((item) => item.doc_type === option.type);
                  return (
                    <div className="rounded-lg border border-border bg-muted/30 p-4" key={option.type}>
                      <Label htmlFor={`formation-${option.type}`}>{option.label}</Label>
                      <Input
                        id={`formation-${option.type}`}
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        className="mt-2"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          updateFormationDoc(option.type, { file, file_id: undefined });
                        }}
                      />
                      {doc?.file_id && <p className="text-xs text-muted-foreground mt-2">Uploaded: {doc.file_id}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <div />
          <Button type="submit" variant="hero" disabled={loading || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
