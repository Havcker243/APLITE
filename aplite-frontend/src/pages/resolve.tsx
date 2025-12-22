import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { ResolveForm } from "../components/ResolveForm";
import { ResolutionResult } from "../components/ResolutionResult";
import { resolveUPI } from "../utils/api";
import { useAuth } from "../utils/auth";
import { requireVerifiedOrRedirect } from "../utils/requireVerified";

const UPI_PATTERN = /^[A-Z0-9]{14}$/;

export default function ResolvePage() {
  const { token, loading, profile } = useAuth();
  const router = useRouter();
  const [upi, setUpi] = useState("");
  const [rail, setRail] = useState<"ACH" | "WIRE_DOM" | "SWIFT">("ACH");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    requireVerifiedOrRedirect({ profile, router });
  }, [loading, token, profile, router]);

  async function handleResolve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (!UPI_PATTERN.test(upi.trim())) {
      setError("UPI must be exactly 14 alphanumeric characters");
      return;
    }
    setResolving(true);
    try {
      const response = await resolveUPI({ upi: upi.trim(), rail });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resolve UPI");
    } finally {
      setResolving(false);
    }
  }

  if (!token) {
    return null;
  }

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Resolve Identifier</p>
          <h1 className="hero-title">Verify payout details for a UPI</h1>
          <p className="hero-subtitle">Enter a UPI from your workspace to fetch payment coordinates and public profile info.</p>
        </div>
      </section>

      {error && (
        <div className="error-box" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <ResolveForm upi={upi} rail={rail} loading={resolving} onUpiChange={setUpi} onRailChange={setRail} onSubmit={handleResolve} />

      {result && <ResolutionResult result={result} />}
    </div>
  );
}
