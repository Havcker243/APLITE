import React, { useState } from "react";

type CalEmbedProps = {
  calLink?: string;
  username?: string;
  eventSlug?: string;
  onSchedule?: () => void;
  variant?: "modal" | "inline";
};

type CalConfig = { username: string; eventSlug: string } | null;

function parseCalLink(raw: string): CalConfig {
  const value = (raw || "").trim();
  if (!value) return null;
  const cleaned = value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^cal\.com\//i, "")
    .split("?", 1)[0]
    .split("#", 1)[0];
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { username: parts[0], eventSlug: parts[1] };
}

export function CalEmbed({ calLink, username, eventSlug, onSchedule, variant = "modal" }: CalEmbedProps) {
  const parsed = calLink ? parseCalLink(calLink) : null;
  const resolved = parsed || (username && eventSlug ? { username, eventSlug } : null);
  const [open, setOpen] = useState(false);

  if (!resolved) {
    return (
      <div className="hero-subtitle">
        Cal.com booking is not configured. Set NEXT_PUBLIC_CAL_LINK or
        NEXT_PUBLIC_CAL_USERNAME and NEXT_PUBLIC_CAL_EVENT_SLUG.
      </div>
    );
  }

  const src = `https://cal.com/${resolved.username}/${resolved.eventSlug}?embed=true`;

  if (variant === "inline") {
    // Inline embed is used inside the app modal to avoid nested popups.
    return (
      <div className="cal-embed-inline">
        <div className="cal-embed-shell">
          <iframe title="Schedule verification call" src={src} className="cal-embed-frame" />
        </div>
        {onSchedule && (
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <input type="checkbox" onChange={(e) => e.target.checked && onSchedule()} />
            <span className="input-label">I scheduled my verification call</span>
          </label>
        )}
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="button" onClick={() => setOpen(true)}>
        Book verification call
      </button>
      <p className="hero-subtitle" style={{ marginTop: 10 }}>
        Once you book, we will verify the details on the call and activate your account.
      </p>
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Schedule verification call">
          <div className="modal-card soft-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div>
                <p className="section-title" style={{ marginBottom: 6 }}>
                  Schedule call
                </p>
                <p className="hero-subtitle" style={{ margin: 0 }}>
                  Pick a time that works for you.
                </p>
              </div>
              <button type="button" className="button button-secondary" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <div className="cal-embed-shell">
              <iframe title="Schedule verification call" src={src} className="cal-embed-frame" />
            </div>
            {onSchedule && (
              <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                <input type="checkbox" onChange={(e) => e.target.checked && onSchedule()} />
                <span className="input-label">I scheduled my verification call</span>
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
