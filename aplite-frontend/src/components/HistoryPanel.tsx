import React from "react";
import { BusinessSummary } from "../utils/api";

type HistoryPanelProps = {
  entries: BusinessSummary[];
  onCopy?: (upi: string) => void;
  onDeactivate?: (id: number) => void;
  deactivatingId?: number | null;
};

function maskUpi(upi: string) {
  return `${upi.slice(0, 3)}${"*".repeat(Math.max(upi.length - 3, 0))}`;
}

export function HistoryPanel({ entries, onCopy, onDeactivate, deactivatingId }: HistoryPanelProps) {
  if (!entries.length) {
    return (
      <div className="card" style={{ marginTop: 20 }}>
        <p className="section-title">Recent UPIs</p>
        <p className="hero-subtitle">Mint a business to see it appear here.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <p className="section-title">Recent UPIs</p>
      <div className="table">
        <div className="table-head">
          <span>UPI</span>
          <span>Legal Name</span>
          <span>Rails</span>
          <span>Created</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {entries.map((entry) => {
          const dateLabel = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "pending";
          const isDeactivated = entry.status === "deactivated";
          return (
            <div key={entry.id} className="table-row">
              <span className="history-upi">{maskUpi(entry.upi)}</span>
              <span>{entry.legal_name}</span>
              <span>{entry.rails?.join(", ") || "—"}</span>
              <span className="history-meta">{dateLabel}</span>
              <span className="status-pill">{isDeactivated ? "deactivated" : entry.verification_status}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="button button-secondary" onClick={() => onCopy?.(entry.upi)} disabled={isDeactivated}>
                  Copy
                </button>
                {onDeactivate && (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => onDeactivate(entry.id)}
                    disabled={isDeactivated || deactivatingId === entry.id}
                  >
                    {deactivatingId === entry.id ? "Deactivating…" : "Deactivate"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
