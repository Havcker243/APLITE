import React from "react";
import { BusinessSummary } from "../utils/api";

type HistoryPanelProps = {
  entries: BusinessSummary[];
  onCopy?: (upi: string) => void;
};

function maskUpi(upi: string) {
  return `${upi.slice(0, 3)}${"*".repeat(Math.max(upi.length - 3, 0))}`;
}

export function HistoryPanel({ entries, onCopy }: HistoryPanelProps) {
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
      <div className="history-list">
        {entries.map((entry) => {
          const dateLabel = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "pending";
          return (
            <div key={entry.id} className="history-item">
              <div>
                <div className="history-upi">{maskUpi(entry.upi)}</div>
                <div className="history-meta">
                  {entry.legal_name} - {dateLabel}
                </div>
              </div>
              <div className="history-actions">
                <span className="status-pill">{entry.verification_status}</span>
                <button type="button" className="button button-secondary" onClick={() => onCopy?.(entry.upi)}>
                  Copy
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
