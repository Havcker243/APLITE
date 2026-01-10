/**
 * Result display for UPI resolution lookups.
 * Renders account details returned by the resolve endpoint.
 */

import React from "react";

type ResolutionResultProps = {
  result: {
    upi: string;
    rail: string;
    business: {
      legal_name: string;
      country: string;
    };
    profile?: {
      company_name?: string;
      summary?: string;
      established_year?: number;
      state?: string | null;
      country?: string | null;
    };
    coordinates: Record<string, string>;
  };
};

export function ResolutionResult({ result }: ResolutionResultProps) {
  /** Render resolved business + payout coordinates for a UPI. */
  const { business, coordinates, profile } = result;
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="inline-flex items-center rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
        Resolution Complete
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">Verified Business</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InfoField label="Legal Name" value={business.legal_name} emphasis />
        <InfoField label="Country" value={business.country} />
        <InfoField label="UPI" value={result.upi} mono />
        <InfoField label="Rail" value={result.rail} />
      </div>

      {profile && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Profile</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <InfoField label="Company" value={profile.company_name || business.legal_name} />
            <InfoField label="Established" value={profile.established_year?.toString() || "-"} />
            <InfoField label="Location" value={[profile.state, profile.country].filter(Boolean).join(", ") || business.country} />
            {profile.summary && <InfoField label="Summary" value={profile.summary} spanFull />}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Coordinates</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <InfoField label="Bank Name" value={coordinates.bank_name || ""} />
          {"routing_number" in coordinates && <InfoField label="Routing Number" value={coordinates.routing_number} mono />}
          {"account_number" in coordinates && <InfoField label="Account Number" value={coordinates.account_number} mono />}
          {"bank_address" in coordinates && <InfoField label="Bank Address" value={coordinates.bank_address} spanFull />}
          {"swift_bic" in coordinates && <InfoField label="SWIFT/BIC" value={coordinates.swift_bic} mono />}
          {"iban" in coordinates && <InfoField label="IBAN" value={coordinates.iban} mono />}
          {"bank_country" in coordinates && <InfoField label="Bank Country" value={coordinates.bank_country} />}
          {"bank_city" in coordinates && <InfoField label="Bank City" value={coordinates.bank_city} />}
        </div>
      </div>
    </div>
  );
}

function InfoField({
  label,
  value,
  mono = false,
  emphasis = false,
  spanFull = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
  spanFull?: boolean;
}) {
  /** Render a label/value pair with optional styling. */
  return (
    <div className={spanFull ? "md:col-span-2" : undefined}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm text-foreground ${mono ? "font-mono" : ""} ${emphasis ? "text-base font-semibold" : ""}`}>
        {value || "-"}
      </p>
    </div>
  );
}
