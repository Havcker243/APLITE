const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

let authToken: string | null = null;

export type OnboardingStep1Payload = {
  legal_name: string;
  dba?: string;
  ein: string;
  formation_date: string;
  formation_state: string;
  entity_type: string;
  address: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  industry: string;
  website?: string;
  description?: string;
};

export type OnboardingStep1Response = {
  org_id: string;
  session_id: string;
  next_step: number;
};

export type OnboardingCurrentResponse = {
  session_id: string;
  org_id: string;
  state: string;
  current_step: number;
  risk_level: "low" | "medium" | "high";
  address_locked: boolean;
  org: any;
};

export type ProfileDetailsResponse = {
  user: User;
  onboarding: {
    id: string;
    org_id: string;
    user_id: number;
    state: string;
    current_step: number;
    risk_level: string;
    address_locked: boolean;
    last_saved_at?: string;
    completed_at?: string | null;
    step_statuses?: any;
  } | null;
  organization: {
    id: string;
    legal_name: string;
    dba?: string | null;
    ein: string;
    formation_date: string;
    formation_state: string;
    entity_type: string;
    address: any;
    industry: string;
    website?: string | null;
    description?: string | null;
    issued_upi?: string | null;
    created_at?: string;
    updated_at?: string;
  } | null;
  stats: {
    payment_accounts: number;
    upis: number;
  };
};

export type OnboardingStep2Payload = { role: "owner" | "authorized_rep"; title?: string };
export type OnboardingStep3Payload = { full_name: string; title?: string; id_document_id: string; attestation: boolean };
export type OnboardingStep4Payload = {
  bank_name: string;
  account_number: string;
  ach_routing?: string;
  wire_routing?: string;
  swift?: string;
};

export type BusinessPayload = {
  legal_name: string;
  ein: string;
  business_type: string;
  website?: string;
  address: string;
  country: string;
  payment_account_id?: number;
  account?: AccountPayload;
};

export type AccountPayload = {
  rail: "ACH" | "WIRE_DOM" | "SWIFT";
  bank_name: string;
  account_name?: string;
  ach_routing?: string;
  ach_account?: string;
  wire_routing?: string;
  wire_account?: string;
  bank_address?: string;
  swift_bic?: string;
  iban?: string;
  bank_country?: string;
  bank_city?: string;
};

export type ResolvePayload = {
  upi: string;
  rail: "ACH" | "WIRE_DOM" | "SWIFT";
};

export type BusinessSummary = {
  id: number;
  upi: string;
  legal_name: string;
  rails: string[];
  verification_status: string;
  created_at: string;
  parent_upi?: string;
  status?: string;
};

export type User = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  company_name?: string;
  summary?: string;
  established_year?: number;
  state?: string;
  country?: string;
  master_upi: string;
  created_at?: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type LoginStartResponse = {
  login_id: string;
  detail: string;
};

export type ResolveResult = {
  upi: string;
  rail: string;
  business: { legal_name: string; country: string };
  profile: {
    company_name?: string;
    summary?: string;
    established_year?: number;
    state?: string | null;
    country?: string | null;
  };
  coordinates: Record<string, string>;
};

export function setAuthToken(token: string | null) {
  /** Set the bearer token used by all API calls in this module. */
  authToken = token;
}

function authHeaders(): Record<string, string> {
  /** Build Authorization headers (empty when logged out). */
  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

async function parseError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    return body?.detail || body?.message || fallback;
  } catch {
    try {
      return (await res.text()) || fallback;
    } catch {
      return fallback;
    }
  }
}

export async function signup(data: {
  /** Create a new user and immediately receive a session token. */
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  summary?: string;
  established_year?: number;
  state?: string;
  country?: string;
  password: string;
  confirm_password: string;
  accept_terms: boolean;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to create account");
  }

  return res.json();
}

export async function login(data: { email: string; password: string }): Promise<AuthResponse> {
  /** Legacy helper kept for compatibility; use `loginStart` + `loginVerify`. */
  throw new Error("Two-factor login now requires loginStart and loginVerify");
}

export async function loginStart(data: { email: string; password: string }): Promise<LoginStartResponse> {
  /** Start login: password + email OTP delivery (MVP). */
  const res = await fetch(`${API_BASE_URL}/api/auth/login/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let message = "Failed to start login";
    try {
      const body = await res.json();
      message = body?.detail || message;
    } catch {
      try {
        message = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(message);
  }
  return res.json();
}

export async function loginVerify(data: { login_id: string; code: string }): Promise<AuthResponse> {
  /** Complete login by verifying the OTP; returns a session token + user. */
  const res = await fetch(`${API_BASE_URL}/api/auth/login/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let message = "Invalid code";
    try {
      const body = await res.json();
      message = body?.detail || message;
    } catch {
      try {
        message = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(message);
  }
  return res.json();
}

export async function logout(): Promise<void> {
  /** Best-effort logout: invalidates the server session token for the current user. */
  if (!authToken) return;
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { ...authHeaders() },
    });
  } catch {
    // ignore network errors during logout
  }
}

export async function onboardBusiness(data: BusinessPayload) {
  /** Create a business and mint a new UPI under the authenticated user's workspace. */
  const res = await fetch(`${API_BASE_URL}/api/businesses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to create business");
  }

  return res.json();
}

export async function resolveUPI(data: ResolvePayload) {
  /** Resolve an owned UPI to payout coordinates for a specific rail. */
  const res = await fetch(`${API_BASE_URL}/api/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let detail = "Failed to resolve UPI";
    try {
      const error = await res.json();
      detail = error?.detail || detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }

  return res.json();
}

export async function fetchBusinesses(limit?: number): Promise<BusinessSummary[]> {
  /** Load recently created businesses/UPIs for the authenticated user. */
  const params = limit ? `?limit=${limit}` : "";
  const res = await fetch(`${API_BASE_URL}/api/businesses${params}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to load business history");
  }

  return res.json();
}

export async function deactivateBusiness(id: number) {
  /** Deactivate a business/UPI so it can no longer be resolved. */
  const res = await fetch(`${API_BASE_URL}/api/businesses/${id}/deactivate`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Failed to deactivate");
  }
  return res.json();
}

export async function fetchProfile(): Promise<User> {
  /** Fetch the current user's profile. */
  const res = await fetch(`${API_BASE_URL}/api/profile`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    throw new Error("Failed to load profile");
  }
  return res.json();
}

export async function fetchProfileDetails(): Promise<ProfileDetailsResponse> {
  /** Fetch a richer profile snapshot including onboarding/organization info. */
  const res = await fetch(`${API_BASE_URL}/api/profile/details`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    throw new Error("Failed to load profile details");
  }
  return res.json();
}

export async function updateOnboardingProfile(data: {
  dba?: string | null;
  address?: { street1: string; street2?: string | null; city: string; state: string; zip: string; country: string } | null;
  industry?: string | null;
  website?: string | null;
  description?: string | null;
}) {
  /** Update onboarding/business profile fields displayed on the Profile page. */
  const res = await fetch(`${API_BASE_URL}/api/profile/onboarding`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to update onboarding profile"));
  }
  return res.json();
}

export async function fetchPublicClients(query?: string) {
  /** Load the public directory of verified clients (optional `search` filter). */
  const params = new URLSearchParams();
  if (query) params.set("search", query);
  const res = await fetch(`${API_BASE_URL}/api/public/clients${params.toString() ? `?${params.toString()}` : ""}`);
  if (!res.ok) {
    throw new Error("Failed to load clients");
  }
  return res.json();
}

export async function updateProfile(data: {
  /** Update the current user's public profile fields. */
  company_name?: string;
  summary?: string;
  established_year?: number;
  state?: string;
  country?: string;
}): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error("Failed to update profile");
  }
  return res.json();
}

export async function listAccounts() {
  /** List payout rails/accounts saved for the authenticated user. */
  const res = await fetch(`${API_BASE_URL}/api/accounts`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error("Failed to load accounts");
  }
  return res.json();
}

export async function createAccount(data: AccountPayload) {
  /** Create a new payout rail/account for the authenticated user. */
  const res = await fetch(`${API_BASE_URL}/api/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to create account");
  }
  return res.json();
}

export async function onboardingCurrent(): Promise<OnboardingCurrentResponse> {
  /** Fetch the current active onboarding session (if any). */
  const res = await fetch(`${API_BASE_URL}/onboarding/current`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await parseError(res, "Unable to load onboarding session"));
  return res.json();
}

export async function onboardingStep1(payload: OnboardingStep1Payload): Promise<OnboardingStep1Response> {
  /** Submit onboarding Step 1 (legal entity details). */
  const res = await fetch(`${API_BASE_URL}/onboarding/step-1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to save Step 1"));
  return res.json();
}

export async function onboardingStep2(payload: OnboardingStep2Payload) {
  /** Submit onboarding Step 2 (authorization role). */
  const res = await fetch(`${API_BASE_URL}/onboarding/step-2`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to save Step 2"));
  return res.json();
}

export async function onboardingUploadId(file: File) {
  /** Upload an identity document for onboarding Step 3. */
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/onboarding/upload-id`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: formData,
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to upload document"));
  return res.json() as Promise<{ file_id: string }>;
}

export async function onboardingStep3(payload: OnboardingStep3Payload) {
  /** Submit onboarding Step 3 (identity verification attestation + document reference). */
  const res = await fetch(`${API_BASE_URL}/onboarding/step-3`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to save Step 3"));
  return res.json();
}

export async function onboardingStep4(payload: OnboardingStep4Payload) {
  /** Submit onboarding Step 4 (bank rail mapping; account number encrypted server-side). */
  const res = await fetch(`${API_BASE_URL}/onboarding/step-4`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to save Step 4"));
  return res.json();
}

export async function verifySendOtp(method: "email" | "sms") {
  /** Send an onboarding verification OTP (email or SMS; SMS is stubbed in MVP). */
  const res = await fetch(`${API_BASE_URL}/verify/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ method }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to send OTP"));
  return res.json();
}

export async function verifyConfirmOtp(code: string) {
  /** Confirm onboarding verification OTP; completes onboarding and issues a UPI. */
  const res = await fetch(`${API_BASE_URL}/verify/confirm-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to confirm OTP"));
  return res.json();
}

export async function verifyAvailableSlots() {
  /** Fetch available verification-call slots (deterministic in MVP). */
  const res = await fetch(`${API_BASE_URL}/verify/available-slots`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await parseError(res, "Unable to load slots"));
  return res.json() as Promise<{ slots: string[] }>;
}

export async function verifyScheduleCall(scheduled_at: string) {
  /** Schedule a verification call for onboarding. */
  const res = await fetch(`${API_BASE_URL}/verify/schedule-call`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ scheduled_at }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to schedule call"));
  return res.json();
}
