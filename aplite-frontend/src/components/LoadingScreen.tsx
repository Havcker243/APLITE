/**
 * Full-screen loading state used during auth or data hydration.
 * Keeps the UI stable while backend state is fetched.
 */

import React from "react";
import { Loader2 } from "lucide-react";

type LoadingScreenProps = {
  label?: string;
};

export function LoadingScreen({ label = "Loading..." }: LoadingScreenProps) {
  /** Fullscreen loading indicator with optional label. */
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default LoadingScreen;
