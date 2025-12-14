import React, { useState } from "react";

type ResultCardProps = {
  upi: string;
};

export function ResultCard({ upi }: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(upi)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));

    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card result-card">
      <div className="status-pill">Unified Payment Identifier</div>
      <h2 style={{ margin: "8px 0" }}>Your UPI</h2>
      <div style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "0.18em" }}>{upi}</div>
      <p style={{ color: "var(--text-muted)", marginBottom: "18px" }}>Share this with payers or platforms to receive funds through Aplite.</p>
      <button type="button" className="button button-secondary" onClick={handleCopy}>
        Copy Identifier
      </button>
      {copied && <div className="copy-message">Copied to clipboard</div>}
    </div>
  );
}
