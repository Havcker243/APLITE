/**
 * Shared toast helpers for consistent error messaging.
 * Keeps API errors readable without duplicating logic per page.
 */

import { toast } from "sonner";

export function getErrorMessage(err: unknown, fallback: string) {
  /** Normalize thrown errors into a user-friendly message. */
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}

export function toastApiError(err: unknown, fallback: string) {
  /** Show a standard error toast with optional detail text. */
  const message = getErrorMessage(err, fallback);
  if (message === fallback) {
    toast.error(fallback);
    return;
  }
  toast.error(fallback, { description: message });
}
