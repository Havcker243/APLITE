import { ProfileDetailsResponse } from "./api";

// Single guard: trust backend onboarding_status to gate access.
export function requireVerifiedOrRedirect(opts: { profile: ProfileDetailsResponse | null; router: any }) {
  if (!opts.profile) return;
  const status = String(opts.profile.onboarding_status || "NOT_STARTED");
  if (status !== "VERIFIED") {
    opts.router.replace("/onboard");
  }
}
