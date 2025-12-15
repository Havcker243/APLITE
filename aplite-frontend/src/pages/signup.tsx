import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import { signup } from "../utils/api";
import { useAuth } from "../utils/auth";

const initialState = {
  first_name: "",
  last_name: "",
  email: "",
  company_name: "",
  summary: "",
  established_year: "",
  state: "",
  country: "",
  password: "",
  confirm_password: "",
  accept_terms: false,
};

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = event.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await signup({
        ...form,
        established_year: form.established_year ? Number(form.established_year) : undefined,
      });
      login(response);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Create Account</p>
          <h1 className="hero-title">Mint your master UPI</h1>
          <p className="hero-subtitle">Securely create your workspace and generate a master UPI before attaching bank accounts.</p>
        </div>
      </section>

      {error && (
        <div className="error-box" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card form-card">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div className="input-group">
            <label className="input-label" htmlFor="first_name">
              First Name
            </label>
            <input id="first_name" name="first_name" value={form.first_name} onChange={handleChange} className="input-control" required />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="last_name">
              Last Name
            </label>
            <input id="last_name" name="last_name" value={form.last_name} onChange={handleChange} className="input-control" required />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="email">
              Work Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className="input-control"
              required
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="company_name">
              Company Name
            </label>
            <input id="company_name" name="company_name" value={form.company_name} onChange={handleChange} className="input-control" required />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="summary">
              Company Summary
            </label>
            <textarea id="summary" name="summary" value={form.summary} onChange={handleChange} className="input-control" placeholder="What does your company do?" />
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
          <div className="input-group">
            <label className="input-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              className="input-control"
              minLength={6}
              required
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="confirm_password">
              Confirm Password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              value={form.confirm_password}
              onChange={handleChange}
              className="input-control"
              minLength={6}
              required
            />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <input type="checkbox" name="accept_terms" checked={form.accept_terms} onChange={handleChange} />
          <span className="input-label">I agree to the Terms of Service</span>
        </label>

        <button type="submit" className="button" disabled={loading}>
          {loading && <span className="spinner" aria-hidden="true" />}
          Create Account
        </button>

        <p className="hero-subtitle" style={{ marginTop: 10 }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
