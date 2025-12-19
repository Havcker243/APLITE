import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { loginStart, loginVerify } from "../utils/api";
import { useAuth } from "../utils/auth";

const initialState = {
  email: "",
  password: "",
};

export default function LoginPage() {
  const router = useRouter();
  const { login: setAuth, token, ready } = useAuth();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginId, setLoginId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    const next = typeof router.query.next === "string" ? router.query.next : "/dashboard";
    router.replace(next);
  }, [ready, token, router]);

  if (ready && token) return null;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const email = form.email.trim();
    const password = form.password;
    if (!email || !password) {
      setLoading(false);
      setError("Enter your email and password to continue.");
      return;
    }
    try {
      const response = await loginStart({ email, password });
      setLoginId(response.login_id);
      setInfo("Check your email for the 6-digit code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start login");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loginId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await loginVerify({ login_id: loginId, code: otp.trim() });
      setAuth(response);
      const next = typeof router.query.next === "string" ? router.query.next : response.needs_onboarding ? "/onboard" : "/dashboard";
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Welcome back</p>
          <h1 className="hero-title">Access your UPI workspace</h1>
          <p className="hero-subtitle">Log in to manage master and child UPIs, copy payout coordinates, and resolve identifiers.</p>
        </div>
      </section>

      {error && (
        <div className="error-box" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
      {info && (
        <div className="status-pill" role="status" aria-live="polite">
          {info}
        </div>
      )}

      <form onSubmit={loginId ? handleVerify : handleSubmit} className="card form-card" style={{ maxWidth: 520 }}>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="input-group">
            <label className="input-label" htmlFor="email">
              Email
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
            <label className="input-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              className="input-control"
              required
            />
          </div>
          {loginId && (
            <div className="input-group">
              <label className="input-label" htmlFor="otp">
                Verification Code
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                className="input-control"
                maxLength={6}
                inputMode="numeric"
                required
              />
            </div>
          )}
        </div>
        <button type="submit" className="button" disabled={loading}>
          {loading && <span className="spinner" aria-hidden="true" />}
          {loginId ? "Verify Code" : "Login"}
        </button>
        <p className="hero-subtitle" style={{ marginTop: 10 }}>
          Need an account? <Link href="/signup">Create one</Link>
        </p>
      </form>
    </div>
  );
}
