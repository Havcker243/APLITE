import { fetchProfileDetails } from "./api";

export async function requireVerifiedOrRedirect(opts: { token: string | null; router: any }) {
  if (!opts.token) return;
  try {
    const details = await fetchProfileDetails();
    const state = String(details?.onboarding?.state || "NOT_STARTED");
    if (state !== "VERIFIED") {
      opts.router.replace("/onboard");
    }
  } catch {
    // If profile details can't load, keep user moving toward onboarding.
    opts.router.replace("/onboard");
  }
}

