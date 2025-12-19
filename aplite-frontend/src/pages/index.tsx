import Link from "next/link";
import React from "react";

export default function HomePage() {
  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Aplite</p>
          <h1 className="hero-title">Instant banking identity for platforms</h1>
          <p className="hero-subtitle">
            Create an account, mint your master UPI, and manage all payout coordinates from one secure dashboard. Log in to generate child accounts
            and resolve them on demand.
          </p>
        </div>
      </section>

      <div className="card-grid">
        <div className="card">
          <h2>Create your workspace</h2>
          <p className="hero-subtitle">Sign up to mint your master UPI and start attaching verified payout accounts.</p>
          <Link className="button" href="/onboard">
            Get Started
          </Link>
        </div>
        <div className="card">
          <h2>Already onboarded?</h2>
          <p className="hero-subtitle">Log in to manage existing UPIs, copy payout details, or add new payment rails.</p>
          <Link className="button button-secondary" href="/login">
            Login
          </Link>
        </div>
      </div>

      <div className="pill-row">
        <div className="pill">
          <p className="pill-title">Developer-first</p>
          <p className="pill-subtitle">Issue/resolve without bank-file chaos.</p>
        </div>
        <div className="pill">
          <p className="pill-title">KYB in one flow</p>
          <p className="pill-subtitle">Business, authorization, ID, rails, OTP.</p>
        </div>
        <div className="pill">
          <p className="pill-title">Verified resolves</p>
          <p className="pill-subtitle">Encrypted coords for verified accounts only.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 28 }}>
        <p className="section-title">How it works</p>
        <div className="timeline">
          <div className="timeline-item">
            <div className="timeline-dot">1</div>
            <div>
              <p className="pill-title" style={{ marginBottom: 4 }}>
                Create
              </p>
              <p className="hero-subtitle">Sign up to mint a master UPI namespace.</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot">2</div>
            <div>
              <p className="pill-title" style={{ marginBottom: 4 }}>
                Onboard
              </p>
              <p className="hero-subtitle">Entity, authorization, ID doc, bank rails, OTP verify.</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot">3</div>
            <div>
              <p className="pill-title" style={{ marginBottom: 4 }}>
                Issue
              </p>
              <p className="hero-subtitle">Generate child UPIs per payout rail.</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot">4</div>
            <div>
              <p className="pill-title" style={{ marginBottom: 4 }}>
                Resolve
              </p>
              <p className="hero-subtitle">Share UPIs; resolve to encrypted coordinates on demand.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: 28 }}>
        <div className="card">
          <p className="section-title">Security by default</p>
          <ul style={{ paddingLeft: 16, marginTop: 8, color: "var(--text-muted)" }}>
            <li>AES-GCM encrypted bank coordinates at rest.</li>
            <li>HMAC-signed identifiers with user-specific namespaces.</li>
            <li>Session tokens stored hashed in the database.</li>
          </ul>
        </div>
        <div className="card">
          <p className="section-title">Built for teams</p>
          <p className="hero-subtitle">Share master UPIs, create multiple payout rails, and resolve securely with OTP-gated onboarding.</p>
          <Link className="button" href="/onboard" style={{ marginTop: 12 }}>
            Start onboarding
          </Link>
        </div>
      </div>
    </div>
  );
}
