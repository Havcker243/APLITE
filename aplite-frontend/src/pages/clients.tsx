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
  industry?: string;
  description?: string;
};

export default function ClientsPage() {
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

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

      <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
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
          normalizedClients.map((client) => {
            const isOpen = activeId === client.id;
            return (
              <div
                key={client.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.02)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(isOpen ? null : client.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "14px 18px",
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                  aria-expanded={isOpen}
                  aria-controls={`client-${client.id}`}
                >
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    <span className="section-title" style={{ margin: 0 }}>
                      {client.displayName}
                    </span>
                    <span className="hero-subtitle">
                      {client.location || "Location pending"}
                      {client.established_year ? ` - Est. ${client.established_year}` : ""}
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="status-pill status-pill--success">{client.status}</span>
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-block",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 220ms ease",
                      }}
                    >
                      v
                    </span>
                  </span>
                </button>

                <div
                  id={`client-${client.id}`}
                  style={{
                    maxHeight: isOpen ? 320 : 0,
                    opacity: isOpen ? 1 : 0,
                    overflow: "hidden",
                    transition: "max-height 260ms ease, opacity 200ms ease",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    background: "linear-gradient(120deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                  }}
                >
                  <div style={{ padding: "16px 18px 18px", display: "grid", gap: 12 }}>
                    <div className="hero-subtitle" style={{ margin: 0, maxHeight: 120, overflowY: "auto", paddingRight: 6 }}>
                      {client.description || client.summary || "No public summary provided."}
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div className="hero-subtitle">{client.industry || "Industry not specified"}</div>
                      <div className="hero-subtitle">{client.country || "Global"}</div>
                      <div className="hero-subtitle">Status: {client.status}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {client.website && (
                        <a href={client.website} target="_blank" rel="noreferrer" className="button button-secondary" style={{ marginTop: 0, padding: "8px 14px" }}>
                          Visit site
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

        {!loading && !normalizedClients.length && <div className="hero-subtitle">No clients found.</div>}
      </div>
    </div>
  );
}
