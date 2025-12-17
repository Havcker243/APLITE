import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { fetchProfileDetails, updateOnboardingProfile, updateProfile, User } from "../utils/api";
import { useAuth } from "../utils/auth";
import { YearInput } from "../components/YearInput";
import { CA_PROVINCES, COUNTRIES, isCanada, isUnitedStates, US_STATES } from "../utils/geo";

const initialState = {
  company_name: "",
  summary: "",
  established_year: "",
  state: "",
  country: "",
};

export default function ProfilePage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const [account, setAccount] = useState<User | null>(null);
  const [onboarding, setOnboarding] = useState<any | null>(null);
  const [organization, setOrganization] = useState<any | null>(null);
  const [stats, setStats] = useState<{ payment_accounts: number; upis: number } | null>(null);
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isUS = isUnitedStates(form.country);
  const isCA = isCanada(form.country);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    void loadProfile();
  }, [ready, token]);

  async function loadProfile() {
    try {
      const details = await fetchProfileDetails();
      setAccount(details.user);
      setOnboarding(details.onboarding);
      setOrganization(details.organization);
      setStats(details.stats);

      const profile = details.user;
      const org = details.organization as any;
      const addr = (org?.address as any) || {};
      const formationYear =
        typeof org?.formation_date === "string" && org.formation_date.length >= 4 ? Number(org.formation_date.slice(0, 4)) : undefined;

      setForm({
        company_name: profile.company_name || profile.company || org?.legal_name || "",
        summary: profile.summary || org?.description || "",
        established_year: profile.established_year ? String(profile.established_year) : formationYear ? String(formationYear) : "",
        state: profile.state || addr.state || "",
        country: profile.country || addr.country || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load profile");
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updates: Promise<unknown>[] = [];
      if (organization) {
        updates.push(
          updateOnboardingProfile({
            dba: organization.dba ?? null,
            industry: organization.industry ?? null,
            website: organization.website ?? null,
            description: organization.description ?? null,
            address: organization.address ?? null,
          })
        );
      }
      updates.push(
        updateProfile({
          company_name: form.company_name,
          summary: form.summary,
          established_year: form.established_year ? Number(form.established_year) : undefined,
          state: form.state,
          country: form.country,
        })
      );
      await Promise.all(updates);
      setSuccess("Profile updated");
      void loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile");
    } finally {
      setLoading(false);
    }
  }

  if (!token) return null;

  const createdAt = account?.created_at ? new Date(account.created_at) : null;
  const createdAtLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : account?.created_at || "—";
  const fullName = account ? `${account.first_name || ""} ${account.last_name || ""}`.trim() : "";
  const displayName = fullName || account?.company_name || account?.company || account?.email || "—";
  const onboardingState = String(onboarding?.state || "NOT_STARTED");
  const isVerified = onboardingState === "VERIFIED";

  const orgAddress = organization?.address || {};
  const addressLine = orgAddress
    ? [orgAddress.street1, orgAddress.street2, orgAddress.city, orgAddress.state, orgAddress.zip, orgAddress.country].filter(Boolean).join(", ")
    : "";
  const addressLocked = Boolean(onboarding?.address_locked);

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Profile</p>
          <h1 className="hero-title">Profile</h1>
          <p className="hero-subtitle">Your account details and business profile information.</p>
        </div>
      </section>

      {error && (
        <div className="error-box" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
      {success && (
        <div className="status-pill" role="status" aria-live="polite">
          {success}
        </div>
      )}

      <form className="card form-card" onSubmit={handleSubmit}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <p className="section-title">Your Profile</p>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>{displayName}</h2>
            <p className="hero-subtitle">
              Signed in as <span style={{ color: "var(--text)" }}>{account?.email || "—"}</span> • Created {createdAtLabel}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="status-pill" role="status" aria-live="polite" style={{ margin: 0 }}>
              {isVerified ? "Verified" : onboardingState}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginTop: 18 }}>
          <div>
            <p className="section-title">Account</p>
            <div className="form-grid" style={{ gap: 12 }}>
              <div className="input-group">
                <span className="input-label">First Name</span>
                <div className="input-control">{account?.first_name || "—"}</div>
              </div>
              <div className="input-group">
                <span className="input-label">Last Name</span>
                <div className="input-control">{account?.last_name || "—"}</div>
              </div>
              <div className="input-group">
                <span className="input-label">User ID</span>
                <div className="input-control">{account?.id ?? "—"}</div>
              </div>
              <div className="input-group">
                <span className="input-label">Payout Accounts</span>
                <div className="input-control">{stats?.payment_accounts ?? 0}</div>
              </div>
              <div className="input-group">
                <span className="input-label">Issued UPIs</span>
                <div className="input-control">{stats?.upis ?? 0}</div>
              </div>
            </div>
          </div>

          <div>
            <p className="section-title">Business Profile</p>
            <div className="form-grid" style={{ gap: 12 }}>
              <div className="input-group">
                <span className="input-label">Legal Name</span>
                <div className="input-control">{organization?.legal_name || "—"}</div>
              </div>
              <div className="input-group">
                <span className="input-label">Entity Type</span>
                <div className="input-control">{organization?.entity_type || "—"}</div>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="dba">
                  DBA (optional)
                </label>
                <input
                  id="dba"
                  name="dba"
                  value={organization?.dba || ""}
                  onChange={(e) => setOrganization((prev: any) => ({ ...(prev || {}), dba: e.target.value }))}
                  className="input-control"
                  placeholder="Doing business as"
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="industry">
                  Industry (optional)
                </label>
                <input
                  id="industry"
                  name="industry"
                  value={organization?.industry || ""}
                  onChange={(e) => setOrganization((prev: any) => ({ ...(prev || {}), industry: e.target.value }))}
                  className="input-control"
                  placeholder="e.g. Software"
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="website">
                  Website (optional)
                </label>
                <input
                  id="website"
                  name="website"
                  value={organization?.website || ""}
                  onChange={(e) => setOrganization((prev: any) => ({ ...(prev || {}), website: e.target.value }))}
                  className="input-control"
                  placeholder="example.com"
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="description">
                  Business Description (optional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={organization?.description || ""}
                  onChange={(e) => setOrganization((prev: any) => ({ ...(prev || {}), description: e.target.value }))}
                  className="input-control"
                  rows={4}
                  placeholder="What does your business do?"
                />
              </div>
              <div className="input-group">
                <span className="input-label">Business Address</span>
                <div className="input-control">{addressLine || "—"}</div>
                <p className="hero-subtitle" style={{ marginTop: 8 }}>
                  {addressLocked ? "Address is locked from onboarding Step 1." : "Address can be updated before it becomes locked."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="section-title" style={{ marginTop: 22 }}>
          Public Profile
        </p>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="input-group">
            <label className="input-label" htmlFor="company_name">
              Company Name
            </label>
            <input id="company_name" name="company_name" value={form.company_name} onChange={handleChange} className="input-control" required />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="established_year">
              Year Established
            </label>
            <YearInput id="established_year" name="established_year" value={form.established_year} onChange={(value) => setForm((p) => ({ ...p, established_year: value }))} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="state">
              State/Region
            </label>
            <input
              id="state"
              name="state"
              list={isUS ? "us-states" : isCA ? "ca-provinces" : undefined}
              value={form.state}
              onChange={handleChange}
              className="input-control"
              placeholder={isUS ? "CA" : isCA ? "ON" : "State / Region"}
            />
            {isUS && (
              <datalist id="us-states">
                {US_STATES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
            {isCA && (
              <datalist id="ca-provinces">
                {CA_PROVINCES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            )}
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="country">
              Country
            </label>
            <input
              id="country"
              name="country"
              list="countries"
              value={form.country}
              onChange={(e) => {
                const value = e.target.value;
                setForm((prev) => ({ ...prev, country: value, state: "" }));
              }}
              className="input-control"
              required
            />
            <datalist id="countries">
              {COUNTRIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="input-group" style={{ marginTop: 16 }}>
          <label className="input-label" htmlFor="summary">
            Public Summary
          </label>
          <textarea id="summary" name="summary" value={form.summary} onChange={handleChange} className="input-control" rows={4} />
        </div>
        <button className="button" type="submit" disabled={loading}>
          {loading && <span className="spinner" aria-hidden="true" />}
          Save Changes
        </button>
      </form>
    </div>
  );
}
