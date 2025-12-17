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
    </div>
  );
}
