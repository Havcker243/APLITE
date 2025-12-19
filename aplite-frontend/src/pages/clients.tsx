import React, { useEffect, useMemo, useState } from "react";
import { fetchPublicClients } from "../utils/api";

type Client = {
  id: number;
  legal_name?: string;
  company_name?: string;
  country?: string;
  state?: string;
  summary?: string;
  established_year?: number;
  status?: string;
  website?: string;
};

export default function ClientsPage() {
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(search?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPublicClients(search);
      setClients(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load clients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(query.trim());
  }

  const normalizedClients = useMemo(
    () =>
      clients.map((client) => {
        const website = client.website
          ? client.website.startsWith("http")
            ? client.website
            : `https://${client.website}`
          : null;
        const location = [client.state, client.country].filter(Boolean).join(", ");
        const displayName = client.company_name || client.legal_name || "Unnamed client";
        const status = client.status || "active";
        return { ...client, website, location, displayName, status };
      }),
    [clients]
  );

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Directory</p>
          <h1 className="hero-title">Verified clients</h1>
          <p className="hero-subtitle">Browse public profiles for companies that completed onboarding.</p>
        </div>
      </section>

      {error && (
        <div className="error-box" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card form-card" style={{ maxWidth: 720 }}>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
          <input
            className="input-control"
            placeholder="Search by company name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search clients"
          />
          <button type="submit" className="button" disabled={loading}>
            {loading && <span className="spinner" aria-hidden="true" />}
            Search
          </button>
        </div>
      </form>

      <div className="card-grid" style={{ marginTop: 20 }}>
        {loading &&
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="card card--compact" style={{ minHeight: 150, opacity: 0.8, display: "grid", gap: 8 }}>
              <div className="skeleton" style={{ width: "60%", height: 18 }} />
              <div className="skeleton" style={{ width: "40%", height: 14 }} />
              <div className="skeleton" style={{ width: "100%", height: 44 }} />
              <div className="skeleton" style={{ width: "30%", height: 12 }} />
            </div>
          ))}

        {!loading &&
          normalizedClients.map((client) => (
            <div key={client.id} className="card card--compact" style={{ display: "grid", gap: 8 }}>
              <div className="meta-row">
                <div>
                  <p className="section-title" style={{ marginBottom: 6 }}>
                    {client.country || "Global"}
                  </p>
                  <h3 style={{ margin: 0 }}>{client.displayName}</h3>
                  <p className="hero-subtitle" style={{ marginTop: 4 }}>
                    {client.location || "Location pending"}
                    {client.established_year ? ` • Est. ${client.established_year}` : ""}
                  </p>
                </div>
                <span className="status-pill status-pill--success">{client.status}</span>
              </div>
              <p className="hero-subtitle text-clamp" style={{ margin: 0 }}>
                {client.summary || "No public summary provided."}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {client.website && (
                  <a href={client.website} target="_blank" rel="noreferrer" className="button button-secondary" style={{ marginTop: 0, padding: "8px 14px" }}>
                    Visit site
                  </a>
                )}
              </div>
            </div>
          ))}

        {!loading && !normalizedClients.length && <div className="hero-subtitle">No clients found.</div>}
      </div>
    </div>
  );
}
