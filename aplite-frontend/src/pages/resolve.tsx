import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { ResolveForm } from "../components/ResolveForm";
import { ResolutionResult } from "../components/ResolutionResult";
import { lookupUpiProfile, resolveUPI, UpiLookupResult } from "../utils/api";
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
  const [mode, setMode] = useState<"resolve" | "lookup">("resolve");
  const [lookupUpi, setLookupUpi] = useState("");
  const [lookupResult, setLookupResult] = useState<UpiLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookuping, setLookuping] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    requireVerifiedOrRedirect({ profile, router });
  }, [loading, token, profile, router]);

  useEffect(() => {
    const queryMode = typeof router.query.mode === "string" ? router.query.mode : "resolve";
    const nextMode = queryMode === "lookup" ? "lookup" : "resolve";
    setMode(nextMode);
  }, [router.query.mode]);

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

  async function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    if (!UPI_PATTERN.test(lookupUpi.trim())) {
      setLookupError("UPI must be exactly 14 alphanumeric characters");
      return;
    }
    setLookuping(true);
    try {
      const response = await lookupUpiProfile({ upi: lookupUpi.trim() });
      setLookupResult(response);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Unable to lookup UPI");
    } finally {
      setLookuping(false);
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

      {mode === "resolve" ? (
        <>
          {error && (
            <div className="error-box" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          <ResolveForm upi={upi} rail={rail} loading={resolving} onUpiChange={setUpi} onRailChange={setRail} onSubmit={handleResolve} />

          {result && <ResolutionResult result={result} />}
        </>
      ) : (
        <>
          {lookupError && (
            <div className="error-box" role="alert" aria-live="assertive">
              {lookupError}
            </div>
          )}

          <form onSubmit={handleLookup} className="card form-card">
            <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="input-group">
                <label className="input-label" htmlFor="upi-lookup">
                  UPI
                </label>
                <input
                  id="upi-lookup"
                  className="input-control mono"
                  value={lookupUpi}
                  onChange={(event) => setLookupUpi(event.target.value.toUpperCase().trim())}
                  placeholder="14 characters"
                  required
                />
              </div>
              <button className="button" type="submit" disabled={lookuping}>
                {lookuping && <span className="spinner" aria-hidden="true" />}
                Lookup profile
              </button>
            </div>
          </form>

          {lookupResult && (
            <div className="card" style={{ marginTop: 16 }}>
              <p className="section-title">Organization profile</p>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 10 }}>
                <div className="input-group">
                  <span className="input-label">Legal Name</span>
                  <div className="input-control">{lookupResult.org.legal_name || "-"}</div>
                </div>
                {lookupResult.org.dba && (
                  <div className="input-group">
                    <span className="input-label">DBA</span>
                    <div className="input-control">{lookupResult.org.dba}</div>
                  </div>
                )}
                <div className="input-group">
                  <span className="input-label">Industry</span>
                  <div className="input-control">{lookupResult.org.industry || "-"}</div>
                </div>
                <div className="input-group">
                  <span className="input-label">Website</span>
                  <div className="input-control">{lookupResult.org.website || "-"}</div>
                </div>
                <div className="input-group">
                  <span className="input-label">Country</span>
                  <div className="input-control">{lookupResult.profile.country || "-"}</div>
                </div>
                <div className="input-group">
                  <span className="input-label">Public Summary</span>
                  <div className="input-control" style={{ minHeight: 64 }}>
                    {lookupResult.profile.summary || "No summary provided."}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
