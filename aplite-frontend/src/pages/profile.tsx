import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { fetchProfile, updateProfile } from "../utils/api";
import { useAuth } from "../utils/auth";

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
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const profile = await fetchProfile();
      setForm({
        company_name: profile.company_name || profile.company || "",
        summary: profile.summary || "",
        established_year: profile.established_year ? String(profile.established_year) : "",
        state: profile.state || "",
        country: profile.country || "",
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
      await updateProfile({
        company_name: form.company_name,
        summary: form.summary,
        established_year: form.established_year ? Number(form.established_year) : undefined,
        state: form.state,
        country: form.country,
      });
      setSuccess("Profile updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile");
    } finally {
      setLoading(false);
    }
  }

  if (!token) return null;

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Profile</p>
          <h1 className="hero-title">Company identity</h1>
          <p className="hero-subtitle">Set the public information shown when someone resolves your UPIs.</p>
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
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
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
            <input
              id="established_year"
              name="established_year"
              value={form.established_year}
              onChange={handleChange}
              className="input-control"
              type="number"
              min={1800}
              max={new Date().getFullYear()}
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="state">
              State/Region
            </label>
            <input id="state" name="state" value={form.state} onChange={handleChange} className="input-control" />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="country">
              Country
            </label>
            <input id="country" name="country" value={form.country} onChange={handleChange} className="input-control" required />
          </div>
        </div>
        <div className="input-group" style={{ marginTop: 16 }}>
          <label className="input-label" htmlFor="summary">
            Public Summary
          </label>
          <textarea id="summary" name="summary" value={form.summary} onChange={handleChange} className="input-control" rows={3} />
        </div>
        <button className="button" type="submit" disabled={loading}>
          {loading && <span className="spinner" aria-hidden="true" />}
          Save Profile
        </button>
      </form>
    </div>
  );
}
