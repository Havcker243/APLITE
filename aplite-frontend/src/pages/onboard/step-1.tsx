import React, { useState } from "react";
import { useRouter } from "next/router";
import { OnboardingShell } from "../../components/onboarding/OnboardingShell";
import { onboardingStep1 } from "../../utils/api";
import { useAuth } from "../../utils/auth";
import { COUNTRIES, isCanada, isUnitedStates, US_STATES, CA_PROVINCES } from "../../utils/geo";
import { normalizeEIN, useOnboardingWizard } from "../../utils/onboardingWizard";

export default function OnboardStep1() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const { step1, setStep1, refreshSession } = useOnboardingWizard();

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bizIsUS = isUnitedStates(step1.country);
  const bizIsCA = isCanada(step1.country);

  if (!ready) return null;
  if (!token) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(null);
    setError(null);
    try {
      const industry = step1.industry === "Other" ? step1.industry_other : step1.industry;
      if (step1.industry === "Other" && !step1.industry_other.trim()) {
        throw new Error("Industry is required. Select an industry or specify Other.");
      }
      await onboardingStep1({
        legal_name: step1.legal_name,
        dba: step1.dba || undefined,
        ein: step1.ein,
        formation_date: step1.formation_date,
        formation_state: step1.formation_state,
        entity_type: step1.entity_type,
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
      });
      setSaved("Saved");
      await refreshSession();
      router.push("/onboard/step-2");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save step");
    } finally {
      setLoading(false);
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
              <input id="formation_date" type="date" className="input-control" value={step1.formation_date} onChange={(e) => setStep1((p) => ({ ...p, formation_date: e.target.value }))} required />
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
              <select id="entity_type" className="input-control" value={step1.entity_type} onChange={(e) => setStep1((p) => ({ ...p, entity_type: e.target.value }))}>
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
                <option value="">Select…</option>
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

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
          <button type="button" className="button button-secondary" onClick={() => router.push("/dashboard")}>
            Back to Workspace
          </button>
          <button className="button" type="submit" disabled={loading}>
            {loading && <span className="spinner" aria-hidden="true" />}
            Save & Continue
          </button>
        </div>
      </form>
    </OnboardingShell>
  );
}

