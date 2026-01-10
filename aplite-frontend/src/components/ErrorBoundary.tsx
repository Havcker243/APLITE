/**
 * Global React error boundary to prevent full white-screen crashes.
 * Shows a lightweight fallback with a refresh action.
 */

import React from "react";

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep a console trace since we are not using client-side monitoring yet.
    console.error("UI crash captured by ErrorBoundary:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-gradient-subtle">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
          <div className="rounded-2xl border border-border bg-background/90 p-8 shadow-card backdrop-blur">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Aplite</p>
            <h1 className="mt-4 text-2xl font-semibold text-foreground">Something went wrong</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              We hit an unexpected issue. Please refresh and try again.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
            >
              Refresh page
            </button>
          </div>
        </main>
      </div>
    );
  }
}
