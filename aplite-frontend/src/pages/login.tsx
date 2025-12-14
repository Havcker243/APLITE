import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import { login } from "../utils/api";
import { useAuth } from "../utils/auth";

const initialState = {
  email: "",
  password: "",
};

export default function LoginPage() {
  const router = useRouter();
  const { login: setAuth } = useAuth();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await login(form);
      setAuth(response);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in");
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

      {error && <div className="error-box">{error}</div>}

      <form onSubmit={handleSubmit} className="card form-card" style={{ maxWidth: 520 }}>
        <div className="form-grid">
          <div className="input-group">
            <label className="input-label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange} className="input-control" required />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="password">
              Password
            </label>
            <input id="password" name="password" type="password" value={form.password} onChange={handleChange} className="input-control" required />
          </div>
        </div>
        <button type="submit" className="button" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
        <p className="hero-subtitle" style={{ marginTop: 10 }}>
          Need an account? <Link href="/signup">Create one</Link>
        </p>
      </form>
    </div>
  );
}
