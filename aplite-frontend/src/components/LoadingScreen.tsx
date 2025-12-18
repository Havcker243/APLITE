import React from "react";

export function LoadingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
