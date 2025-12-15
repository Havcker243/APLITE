import React, { useEffect, useState } from "react";
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

  return (
    <div className="page-container">
      <section className="hero">
        <div>
          <p className="section-title">Our present users</p>
          <h1 className="hero-title">Discover verified clients</h1>
          <p className="hero-subtitle">Search public profiles of companies using Aplite.</p>
        </div>
      </section>

      {error && (
        <div className="error-box" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card form-card" style={{ maxWidth: 640 }}>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr auto" }}>
          <input
            className="input-control"
            placeholder="Search by company name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search clients"
          />
          <button type="submit" className="button" disabled={loading} style={{ alignSelf: "stretch" }}>
            {loading && <span className="spinner" aria-hidden="true" />}
            Search
          </button>
        </div>
      </form>

      <div className="card" style={{ marginTop: 20 }}>
        <p className="section-title">Clients</p>
        <div className="table">
          <div className="table-head">
            <span>Name</span>
            <span>Location</span>
            <span>Founded</span>
            <span>Status</span>
            <span>Summary</span>
          </div>
          {clients.map((client) => (
            <div key={client.id} className="table-row">
              <span>
                {client.company_name || client.legal_name}
                {client.website && (
                  <>
                    {" "}
                    ·{" "}
                    <a href={client.website} target="_blank" rel="noreferrer" className="nav-link" style={{ padding: 0 }}>
                      Website
                    </a>
                  </>
                )}
              </span>
              <span>{[client.state, client.country].filter(Boolean).join(", ") || "—"}</span>
              <span>{client.established_year || "—"}</span>
              <span className="status-pill">{client.status || "active"}</span>
              <span className="history-meta">{client.summary || "—"}</span>
            </div>
          ))}
          {!clients.length && !loading && <div className="history-meta">No clients found.</div>}
        </div>
      </div>
    </div>
  );
}
