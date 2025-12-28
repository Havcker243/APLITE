import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { ResolveForm } from "../components/ResolveForm";
import { ResolutionResult } from "../components/ResolutionResult";
import { lookupMasterUpi, lookupUpiProfile, resolveUPI, MasterUpiLookupResult, UpiLookupResult } from "../utils/api";
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
  const [mode, setMode] = useState<"resolve" | "lookup" | "master">("resolve");
  const [lookupUpi, setLookupUpi] = useState("");
  const [lookupResult, setLookupResult] = useState<UpiLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookuping, setLookuping] = useState(false);
  const [masterUpi, setMasterUpi] = useState("");
  const [masterResult, setMasterResult] = useState<MasterUpiLookupResult | null>(null);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [masterLoading, setMasterLoading] = useState(false);

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
    const nextMode = queryMode === "lookup" || queryMode === "master" ? queryMode : "resolve";
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

  async function handleMasterLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMasterError(null);
    setMasterResult(null);
    if (!UPI_PATTERN.test(masterUpi.trim())) {
      setMasterError("UPI must be exactly 14 alphanumeric characters");
      return;
    }
    setMasterLoading(true);
    try {
      const response = await lookupMasterUpi(masterUpi.trim());
      setMasterResult(response);
    } catch (err) {
      setMasterError(err instanceof Error ? err.message : "Unable to lookup master UPI");
    } finally {
      setMasterLoading(false);
    }
  }

  if (!token) {
    return null;
  }

  const modeItems = [
    { key: "resolve", label: "Resolve payout" },
    { key: "lookup", label: "Lookup org" },
    { key: "master", label: "Master UPI" },
  ] as const;

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Resolve Identifier</p>
          <h1 className="hero-title">Verify payout details for a UPI</h1>
          <p className="hero-subtitle">Enter a UPI from your workspace to fetch payment coordinates and public profile info.</p>
        </div>
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {modeItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`button${mode === item.key ? "" : " button-secondary"}`}
            onClick={() => router.push(`/resolve?mode=${item.key}`)}
          >
            {item.label}
          </button>
        ))}
      </div>

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
      ) : mode === "lookup" ? (
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
      ) : (
        <>
          {masterError && (
            <div className="error-box" role="alert" aria-live="assertive">
              {masterError}
            </div>
          )}

          <form onSubmit={handleMasterLookup} className="card form-card">
            <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="input-group">
                <label className="input-label" htmlFor="upi-master">
                  Master UPI
                </label>
                <input
                  id="upi-master"
                  className="input-control mono"
                  value={masterUpi}
                  onChange={(event) => setMasterUpi(event.target.value.toUpperCase().trim())}
                  placeholder="14 characters"
                  required
                />
              </div>
              <button className="button" type="submit" disabled={masterLoading}>
                {masterLoading && <span className="spinner" aria-hidden="true" />}
                Lookup master
              </button>
            </div>
          </form>

          {masterResult && (
            <div className="card" style={{ marginTop: 16 }}>
              <p className="section-title">Owner profile</p>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 10 }}>
                <div className="input-group">
                  <span className="input-label">Company</span>
                  <div className="input-control">{masterResult.owner.company_name || "-"}</div>
                </div>
                <div className="input-group">
                  <span className="input-label">Established</span>
                  <div className="input-control">{masterResult.owner.established_year || "-"}</div>
                </div>
                <div className="input-group">
                  <span className="input-label">Location</span>
                  <div className="input-control">
                    {[masterResult.owner.state, masterResult.owner.country].filter(Boolean).join(", ") || "-"}
                  </div>
                </div>
                <div className="input-group">
                  <span className="input-label">Summary</span>
                  <div className="input-control" style={{ minHeight: 64 }}>
                    {masterResult.owner.summary || "No summary provided."}
                  </div>
                </div>
              </div>

              <p className="section-title" style={{ marginTop: 16 }}>
                Organizations
              </p>
              {masterResult.organizations.length === 0 ? (
                <p className="hero-subtitle">No organizations found for this master UPI.</p>
              ) : (
                <div className="table">
                  <div className="table-head">
                    <span>Legal Name</span>
                    <span>UPI</span>
                    <span>Status</span>
                  </div>
                  {masterResult.organizations.map((org) => (
                    <div key={org.id} className="table-row">
                      <span>{org.legal_name}</span>
                      <span>{org.upi || "-"}</span>
                      <span>{org.verification_status || org.status || "-"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
