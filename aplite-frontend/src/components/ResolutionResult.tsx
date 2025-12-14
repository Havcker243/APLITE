import React from "react";

type ResolutionResultProps = {
  result: {
    upi: string;
    rail: string;
    business: {
      legal_name: string;
      country: string;
    };
    coordinates: Record<string, string>;
  };
};

export function ResolutionResult({ result }: ResolutionResultProps) {
  const { business, coordinates } = result;
  return (
    <div className="card result-card">
      <div className="status-pill">Resolution Complete</div>
      <h2 style={{ marginTop: 0 }}>Verified Business</h2>
      <div className="form-grid" style={{ gap: 8 }}>
        <div>
          <div className="input-label">Legal Name</div>
          <div style={{ fontSize: "1.1rem" }}>{business.legal_name}</div>
        </div>
        <div>
          <div className="input-label">Country</div>
          <div>{business.country}</div>
        </div>
        <div>
          <div className="input-label">UPI</div>
          <div style={{ letterSpacing: "0.2em" }}>{result.upi}</div>
        </div>
        <div>
          <div className="input-label">Rail</div>
          <div>{result.rail}</div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 24 }}>Coordinates</div>
      <div className="form-grid" style={{ gap: 12 }}>
        <div>
          <div className="input-label">Bank Name</div>
          <div>{coordinates.bank_name || ""}</div>
        </div>
        {"routing_number" in coordinates && (
          <div>
            <div className="input-label">Routing Number</div>
            <div>{coordinates.routing_number}</div>
          </div>
        )}
        {"account_number" in coordinates && (
          <div>
            <div className="input-label">Account Number</div>
            <div>{coordinates.account_number}</div>
          </div>
        )}
        {"bank_address" in coordinates && (
          <div>
            <div className="input-label">Bank Address</div>
            <div>{coordinates.bank_address}</div>
          </div>
        )}
      </div>
    </div>
  );
}
