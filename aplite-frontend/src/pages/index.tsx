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

      <div className="card-grid" style={{ marginTop: 28 }}>
        <div className="card">
          <p className="section-title">Why Aplite</p>
          <h3 style={{ marginTop: 0 }}>Developer-first payouts</h3>
          <p className="hero-subtitle">
            Issue and resolve identifiers without juggling bank files. Encryption at rest, HMAC-signed UPIs, OTP-gated onboarding, and audit-friendly history.
          </p>
        </div>
        <div className="card">
          <p className="section-title">Compliance-ready</p>
          <h3 style={{ marginTop: 0 }}>KYB/KYC in one flow</h3>
          <p className="hero-subtitle">
            Collect business identity, authorization, ID documents, and payout rails in sequential steps with OTP verification before issuing UPIs.
          </p>
        </div>
        <div className="card">
          <p className="section-title">Operations</p>
          <h3 style={{ marginTop: 0 }}>Resolve with confidence</h3>
          <p className="hero-subtitle">
            Every resolve validates ownership, verification status, and signature, returning encrypted coordinates only for verified accounts.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 28 }}>
        <p className="section-title">How it works</p>
        <div className="table">
          <div className="table-row">
            <span>1) Create</span>
            <span>Sign up to mint a master UPI namespace.</span>
          </div>
          <div className="table-row">
            <span>2) Onboard</span>
            <span>Complete KYB (entity, authorization, identity, bank rails) and verify via OTP.</span>
          </div>
          <div className="table-row">
            <span>3) Issue</span>
            <span>Generate child UPIs bound to specific payout rails.</span>
          </div>
          <div className="table-row">
            <span>4) Resolve</span>
            <span>Share UPIs and resolve them to coordinates on demand.</span>
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
