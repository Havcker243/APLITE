import React, { useState } from "react";
import { useRouter } from "next/router";
import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
// Step 1 is now local-only; final submit happens on the Verify page.
import { useAuth } from "../../utils/auth";
import { onboardingUploadFormation } from "../../utils/api";
import { COUNTRIES, isCanada, isUnitedStates, US_STATES, CA_PROVINCES } from "../../utils/geo";
import { FormationDocType, normalizeEIN, useOnboardingWizard } from "../../utils/onboardingWizard";
import { LoadingScreen } from "../../components/LoadingScreen";

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
    step2,
    setStep2,
    step3,
    setStep3,
    step4,
    setStep4,
    verify,
    refreshSession,
    currentStep,
    sessionReady,
    clearDraft,
    touchStep,
    markStepComplete,
  } = useOnboardingWizard();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bizIsUS = isUnitedStates(step1.country);
  const bizIsCA = isCanada(step1.country);
  const formationConfig = FORMATION_DOCS[step1.entity_type] || { required: false, options: [] };

  React.useEffect(() => {
    if (loading || !token) return;
    // Fire-and-forget to see if already verified; do not block render.
    void refreshSession();
  }, [loading, token, refreshSession]);

  React.useEffect(() => {
    touchStep(1);
  }, [touchStep]);

  const today = React.useMemo(() => new Date().toISOString().split("T")[0], []);

  if (loading || !token) return <LoadingScreen />;

  function updateFormationDoc(doc_type: FormationDocType, updates: { file?: File; file_id?: string }) {
    setStep1((prev) => {
      const docs = prev.formation_documents || [];
      const idx = docs.findIndex((doc) => doc.doc_type === doc_type);
      const nextDocs = [...docs];
      if (idx >= 0) {
        nextDocs[idx] = { ...nextDocs[idx], ...updates, doc_type };
      } else {
        nextDocs.push({ doc_type, ...updates });
      }
      return { ...prev, formation_documents: nextDocs };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(null);
    setError(null);
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
        for (const doc of provided) {
          if (doc.file && !doc.file_id) {
            // Upload now so the final submit only sends file_id references.
            const res = await onboardingUploadFormation(doc.file, doc.doc_type);
            updateFormationDoc(doc.doc_type, { file_id: res.file_id, file: undefined });
          }
        }
      }
      // Only validate required fields for Step 1; final submit happens on Verify.
      setSaved("Saved locally");
      markStepComplete(1);
      router.push("/onboard/step-2");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingShell title="Stage 1" subtitle="Establish your legal entity. Address becomes read-only after submission." activeStep={1}>
      {saved && (
        <div className="status-pill" role="status" aria-live="polite">
          {saved}
        </div>
      )}
      {error && (
        <div className="error-box" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <form className="card form-card" onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>Establish Legal Entity</h2>

        <div className="form-section">
          <p className="section-title">Business identity</p>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 12 }}>
            <div className="input-group">
              <label className="input-label" htmlFor="legal_name">
                Legal name
              </label>
              <input id="legal_name" className="input-control" value={step1.legal_name} onChange={(e) => setStep1((p) => ({ ...p, legal_name: e.target.value }))} required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="dba">
                DBA (optional)
              </label>
              <input id="dba" className="input-control" value={step1.dba} onChange={(e) => setStep1((p) => ({ ...p, dba: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="ein">
                EIN
              </label>
              <input
                id="ein"
                className="input-control mono"
                value={step1.ein}
                onChange={(e) => setStep1((p) => ({ ...p, ein: normalizeEIN(e.target.value) }))}
                placeholder="12-3456789"
                required
              />
              <span className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
                Format: NN-NNNNNNN
              </span>
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="formation_date">
                Formation date
              </label>
              <input
                id="formation_date"
                type="date"
                className="input-control"
                value={step1.formation_date}
                max={today}
                onChange={(e) => setStep1((p) => ({ ...p, formation_date: e.target.value }))}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="formation_state">
                Formation state
              </label>
              <input
                id="formation_state"
                list={bizIsUS ? "formation-states-us" : bizIsCA ? "formation-provinces-ca" : undefined}
                className="input-control"
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
            <div className="input-group">
              <label className="input-label" htmlFor="entity_type">
                Entity type
              </label>
              <select
                id="entity_type"
                className="input-control"
                value={step1.entity_type}
                onChange={(e) => setStep1((p) => ({ ...p, entity_type: e.target.value, formation_documents: [] }))}
              >
                <option value="LLC">LLC</option>
                <option value="C-Corp">C-Corp</option>
                <option value="S-Corp">S-Corp</option>
                <option value="Partnership">Partnership</option>
                <option value="Non-Profit">Non-Profit</option>
                <option value="Sole Proprietor">Sole Proprietor</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <p className="section-title">Legal address</p>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 12 }}>
            <div className="input-group">
              <label className="input-label" htmlFor="street1">
                Street 1
              </label>
              <input id="street1" className="input-control" value={step1.street1} onChange={(e) => setStep1((p) => ({ ...p, street1: e.target.value }))} required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="street2">
                Street 2 (optional)
              </label>
              <input id="street2" className="input-control" value={step1.street2} onChange={(e) => setStep1((p) => ({ ...p, street2: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="city">
                City
              </label>
              <input id="city" className="input-control" value={step1.city} onChange={(e) => setStep1((p) => ({ ...p, city: e.target.value }))} required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="state">
                State
              </label>
              <input
                id="state"
                list={bizIsUS ? "address-states-us" : bizIsCA ? "address-provinces-ca" : undefined}
                className="input-control"
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
            <div className="input-group">
              <label className="input-label" htmlFor="zip">
                ZIP
              </label>
              <input id="zip" className="input-control mono" value={step1.zip} onChange={(e) => setStep1((p) => ({ ...p, zip: e.target.value }))} placeholder="94105" required />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="country">
                Country
              </label>
              <input
                id="country"
                list="countries"
                className="input-control"
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
          </div>
        </div>

        <div className="form-section">
          <p className="section-title">Business profile</p>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 12 }}>
            <div className="input-group">
              <label className="input-label" htmlFor="industry">
                Industry
              </label>
              <select id="industry" className="input-control" value={step1.industry} onChange={(e) => setStep1((p) => ({ ...p, industry: e.target.value }))} required>
                <option value="">Select...</option>
                <option value="Software">Software</option>
                <option value="Fintech">Fintech</option>
                <option value="E-commerce">E-commerce</option>
                <option value="Marketplace">Marketplace</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {step1.industry === "Other" && (
              <div className="input-group">
                <label className="input-label" htmlFor="industry_other">
                  Specify industry
                </label>
                <input id="industry_other" className="input-control" value={step1.industry_other} onChange={(e) => setStep1((p) => ({ ...p, industry_other: e.target.value }))} required />
              </div>
            )}
            <div className="input-group">
              <label className="input-label" htmlFor="website">
                Website (domain)
              </label>
              <input id="website" className="input-control mono" value={step1.website} onChange={(e) => setStep1((p) => ({ ...p, website: e.target.value }))} placeholder="example.com" />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="description">
                Description (optional)
              </label>
              <textarea id="description" className="input-control" rows={3} value={step1.description} onChange={(e) => setStep1((p) => ({ ...p, description: e.target.value }))} placeholder="Briefly describe what you do." />
            </div>
          </div>
        </div>

        {formationConfig.options.length > 0 && (
          <div className="form-section">
            <p className="section-title">Formation documents</p>
            <p className="hero-subtitle">Upload at least one of the acceptable documents below.</p>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 12 }}>
              {formationConfig.options.map((option) => {
                const doc = step1.formation_documents.find((item) => item.doc_type === option.type);
                return (
                  <div className="input-group" key={option.type}>
                    <label className="input-label" htmlFor={`formation-${option.type}`}>
                      {option.label}
                    </label>
                    <input
                      id={`formation-${option.type}`}
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      className="input-control"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        updateFormationDoc(option.type, { file, file_id: undefined });
                      }}
                    />
                    {doc?.file_id && <span className="hero-subtitle">Uploaded: {doc.file_id}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 18 }}>
          <button className="button" type="submit" disabled={loading}>
            {saving && <span className="spinner" aria-hidden="true" />}
            Save & Continue
          </button>
        </div>
      </form>
    </OnboardingShell>
  );
}
