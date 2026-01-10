/**
 * Typed API client helpers for backend endpoints.
 * Manages auth/CSRF tokens and provides shared request/response types.
 */

const USE_PROXY = process.env.NEXT_PUBLIC_API_PROXY === "1";
const API_BASE_URL = USE_PROXY ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000");
const NGROK_SKIP_HEADER: Record<string, string> = API_BASE_URL.includes("ngrok-free.dev")
  ? { "ngrok-skip-browser-warning": "true" }
  : {};
// In-memory tokens only; cookies remain the primary auth mechanism.
let authToken: string | null = null;
let csrfToken: string | null = null;

export function setAuthToken(token: string | null) {
  /** Store the bearer token for API requests (in-memory only). */
  authToken = token;
}

export function setCsrfToken(token: string | null) {
  /** Store the CSRF token used for cookie-based writes. */
  csrfToken = token;
}

export async function fetchCsrfToken(): Promise<string | null> {
  /** Fetch and cache a CSRF token for state-changing requests. */
  try {
    const headers: Record<string, string> = { ...NGROK_SKIP_HEADER };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
      credentials: "include",
      headers,
    });
    if (!res.ok) return null;
    const body = await res.json();
    const token = typeof body?.csrf_token === "string" ? body.csrf_token : null;
    setCsrfToken(token);
    return token;
  } catch {
    return null;
  }
}
export type OnboardingStep1Payload = {
  legal_name: string;
  dba?: string;
  ein: string;
  formation_date: string;
  formation_state: string;
  entity_type: string;
  formation_documents?: Array<{
    doc_type: "articles_of_organization" | "certificate_of_formation" | "articles_of_incorporation" | "certificate_of_limited_partnership" | "partnership_equivalent";
    file_id: string;
  }>;
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
  step_statuses: any;
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
    upi?: string | null;
    issued_upi?: string | null;
    created_at?: string;
    updated_at?: string;
  } | null;
  stats: {
    payment_accounts: number;
    upis: number;
  };
  onboarding_status?: string;
  verification_review?: {
    status?: string;
    reason?: string;
    reviewed_at?: string;
  } | null;
};

export type OnboardingStep2Payload = { role: "owner" | "authorized_rep"; title?: string };
export type OnboardingStep3Payload = { full_name: string; title?: string; id_document_id?: string; phone?: string; attestation: boolean };
export type OnboardingStep4Payload = {
  bank_name: string;
  account_number: string;
  ach_routing?: string;
  wire_routing?: string;
  swift?: string;
};

export type OnboardingDraftPayload = {
  step: 1 | 2 | 3 | 4;
  data: OnboardingStep1Payload | OnboardingStep2Payload | OnboardingStep3Payload | OnboardingStep4Payload;
  completed?: boolean;
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
  business: {
    legal_name: string;
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    country?: string;
    website?: string;
  };
  profile: {
    company_name?: string;
    summary?: string;
    established_year?: number;
    state?: string | null;
    country?: string | null;
  };
  coordinates: Record<string, string>;
};

export type UpiLookupResult = {
  upi: string;
  org: {
    id: string;
    legal_name: string;
    dba?: string | null;
    ein?: string;
    formation_date?: string | null;
    formation_state?: string | null;
    entity_type?: string | null;
    address?: any;
    industry?: string | null;
    website?: string | null;
    description?: string | null;
    verification_status?: string | null;
    status?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  profile: {
    company_name?: string;
    summary?: string;
    established_year?: number;
    state?: string | null;
    country?: string | null;
  };
};

export type MasterUpiLookupResult = {
  upi: string;
  owner: {
    id: number;
    company_name?: string;
    summary?: string;
    established_year?: number;
    state?: string | null;
    country?: string | null;
  };
  organizations: Array<{
    id: string;
    legal_name: string;
    upi?: string | null;
    verification_status?: string | null;
    status?: string | null;
  }>;
};
// All requests prefer cookie-based auth but also attach Bearer when available.
const defaultInit: RequestInit = { credentials: "include" };

function withAuth(init?: RequestInit): RequestInit {
  /** Merge auth headers + CSRF into a request init block. */
  // Attach Authorization when available; cookies remain the primary auth mechanism.
  const headers: Record<string, string> = { ...NGROK_SKIP_HEADER };
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, init.headers as Record<string, string>);
    }
  }
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  const method = (init?.method || "GET").toUpperCase();
  if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  return {
    ...defaultInit,
    ...init,
    headers,
  };
}

async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  /** Wrapper around fetch that ensures CSRF token is present when needed. */
  const method = (init?.method || "GET").toUpperCase();
  const hasBearer = Boolean(authToken);
  // CSRF token is required for cookie-based writes; skip when using Bearer auth.
  if (!hasBearer && !["GET", "HEAD", "OPTIONS"].includes(method) && !csrfToken) {
    await fetchCsrfToken();
  }
  return fetch(input, withAuth(init));
}

async function parseError(res: Response, fallback: string) {
  /** Parse error responses into a readable message. */
  const status = res.status;
  try {
    const body = await res.json();
    const detail = body?.detail || body?.message;
    if (detail) return detail;
  } catch {
    try {
      const text = await res.text();
      if (text) return text;
    } catch {
      // ignore parse errors
    }
  }

  if (status === 401) return "Please log in again.";
  if (status === 403) return "You do not have access to this resource.";
  if (status === 404) return "We could not find what you requested.";
  if (status === 409) return "This action is already completed.";
  if (status === 422) return "Please check the highlighted fields and try again.";
  if (status === 429) return "Too many requests. Please try again shortly.";
  if (status >= 500) return "We are having trouble right now. Please try again soon.";

  return fallback;
}

export async function signup(data: {
  /** Create a new user and immediately receive a session token. */
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
  accept_terms: boolean;
}): Promise<AuthResponse> {
  const res = await authedFetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to create account");
  }

  const payload = await res.json();
  if (payload?.token) setAuthToken(payload.token);
  return payload;
}

export async function login(data: { email: string; password: string }): Promise<AuthResponse> {
  /** Legacy helper kept for compatibility; use `loginStart` + `loginVerify`. */
  throw new Error("Two-factor login now requires loginStart and loginVerify");
}

export async function loginStart(data: { email: string; password: string }): Promise<LoginStartResponse> {
  /** Start login: password + email OTP delivery (MVP). */
  const res = await authedFetch(`${API_BASE_URL}/api/auth/login/start`, {
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
  const res = await authedFetch(`${API_BASE_URL}/api/auth/login/verify`, {
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
  const payload = await res.json();
  if (payload?.token) setAuthToken(payload.token);
  return payload;
}

export async function logout(): Promise<void> {
  /** Best-effort logout: invalidates the server session token for the current user. */
  try {
    await authedFetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
    });
  } catch {
    // ignore network errors during logout
  }
  setAuthToken(null);
}


export async function resolveUPI(data: ResolvePayload) {
  /** Resolve an owned UPI to payout coordinates for a specific rail. */
  const res = await authedFetch(`${API_BASE_URL}/api/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export async function lookupUpiProfile(data: { upi: string }) {
  /** Lookup a verified UPI and return the org profile (exact match). */
  const res = await authedFetch(`${API_BASE_URL}/api/upi/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let detail = "Unable to lookup UPI";
    try {
      const error = await res.json();
      detail = error?.detail || detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  return res.json() as Promise<UpiLookupResult>;
}

export async function lookupMasterUpi(upi: string) {
  /** Lookup a master UPI (verified users only). */
  const params = new URLSearchParams({ upi });
  const res = await authedFetch(`${API_BASE_URL}/api/upi/master?${params.toString()}`);
  if (!res.ok) {
    throw new Error(await parseError(res, "Unable to lookup master UPI"));
  }
  return res.json() as Promise<MasterUpiLookupResult>;
}


export async function fetchProfile(): Promise<User> {
  /** Fetch the current user's profile. */
  const res = await authedFetch(`${API_BASE_URL}/api/profile`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Failed to load profile");
  }
  return res.json();
}

export async function fetchProfileDetails(): Promise<ProfileDetailsResponse> {
  /** Fetch a richer profile snapshot including onboarding/organization info. */
  const res = await authedFetch(`${API_BASE_URL}/api/profile/details`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Failed to load profile details");
  }
  return res.json();
}

export async function createChildUpi(data: {
  name?: string;
  type: string;
  website?: string;
  account_id?: number;
  rail?: "ACH" | "WIRE_DOM" | "SWIFT";
  bank_name?: string;
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
}) {
  /** Issue a child/org UPI for the current user's org, using an existing or new payment account. */
  const res = await authedFetch(`${API_BASE_URL}/api/orgs/child-upi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Unable to create child UPI"));
  }
  return res.json() as Promise<{ child_upi_id: string; upi: string; payment_account_id: number }>;
}

export async function listChildUpis(options?: { limit?: number; before?: string }) {
  /** List payment accounts/child UPIs for the current org. */
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.before) params.set("before", options.before);
  const url = `${API_BASE_URL}/api/orgs/child-upis${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await authedFetch(url);
  if (!res.ok) {
    throw new Error(await parseError(res, "Unable to load child UPIs"));
  }
  return res.json() as Promise<
    Array<{
      child_upi_id?: string;
      upi: string;
      payment_account_id: number;
      rail: string;
      bank_name?: string;
      status?: string;
      created_at?: string;
      disabled_at?: string;
    }>
  >;
}

export async function disableChildUpi(childUpiId: string) {
  /** Disable a child UPI so it can no longer be resolved. */
  const res = await authedFetch(`${API_BASE_URL}/api/orgs/child-upis/${childUpiId}/disable`, { method: "POST" });
  if (!res.ok) {
    throw new Error(await parseError(res, "Unable to disable UPI"));
  }
  return res.json() as Promise<{ child_upi_id: string; status: string; disabled_at?: string }>;
}

export async function reactivateChildUpi(childUpiId: string) {
  /** Reactivate a disabled child UPI. */
  const res = await authedFetch(`${API_BASE_URL}/api/orgs/child-upis/${childUpiId}/reactivate`, { method: "POST" });
  if (!res.ok) {
    throw new Error(await parseError(res, "Unable to reactivate UPI"));
  }
  return res.json() as Promise<{ child_upi_id: string; status: string; disabled_at?: string }>;
}

export async function updateOnboardingProfile(data: {
  dba?: string | null;
  address?: { street1: string; street2?: string | null; city: string; state: string; zip: string; country: string } | null;
  industry?: string | null;
  website?: string | null;
  description?: string | null;
}) {
  /** Update onboarding/business profile fields displayed on the Profile page. */
  const res = await authedFetch(`${API_BASE_URL}/api/profile/onboarding`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${API_BASE_URL}/api/public/clients${params.toString() ? `?${params.toString()}` : ""}`, {
    headers: NGROK_SKIP_HEADER,
  });
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
  const res = await authedFetch(`${API_BASE_URL}/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error("Failed to update profile");
  }
  return res.json();
}

export async function listAccounts() {
  /** List payout rails/accounts saved for the authenticated user. */
  const res = await authedFetch(`${API_BASE_URL}/api/accounts`);
  if (!res.ok) {
    throw new Error("Failed to load accounts");
  }
  return res.json();
}

export async function createAccount(data: AccountPayload) {
  /** Create a new payout rail/account for the authenticated user. */
  const res = await authedFetch(`${API_BASE_URL}/api/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to create account");
  }
  return res.json();
}

export async function updateAccount(id: number, data: Partial<AccountPayload>) {
  /** Update an existing payout rail/account for the authenticated user. */
  const res = await authedFetch(`${API_BASE_URL}/api/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to update account"));
  }
  return res.json();
}

export async function onboardingCurrent(): Promise<OnboardingCurrentResponse> {
  /** Fetch the current active onboarding session (if any). */
  const res = await authedFetch(`${API_BASE_URL}/onboarding/current`);
  if (!res.ok) throw new Error(await parseError(res, "Unable to load onboarding session"));
  return res.json();
}

export async function onboardingReset() {
  /** Delete any in-progress onboarding session to restart from Step 1. */
  const res = await authedFetch(`${API_BASE_URL}/onboarding/reset`, { method: "POST" });
  if (!res.ok) throw new Error(await parseError(res, "Unable to reset onboarding session"));
  return res.json();
}

export async function onboardingSaveDraft(payload: OnboardingDraftPayload) {
  /** Save onboarding draft data for a single step. */
  const res = await authedFetch(`${API_BASE_URL}/onboarding/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to save onboarding draft"));
  return res.json();
}

export async function onboardingUploadId(file: File) {
  /** Upload an identity document for onboarding Step 3. */
  const formData = new FormData();
  formData.append("file", file);
  const res = await authedFetch(`${API_BASE_URL}/onboarding/upload-id`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to upload document"));
  return res.json() as Promise<{ file_id: string; storage?: string }>;
}

export async function onboardingUploadFormation(file: File, doc_type: string) {
  /** Upload a formation document for onboarding Step 1. */
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doc_type", doc_type);
  const res = await authedFetch(`${API_BASE_URL}/onboarding/upload-formation`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to upload formation document"));
  return res.json() as Promise<{ file_id: string; storage?: string }>;
}

export async function onboardingComplete(payload: {
  org: OnboardingStep1Payload;
  role: OnboardingStep2Payload;
  identity: OnboardingStep3Payload & { id_document_id?: string };
  bank: OnboardingStep4Payload;
  verification_method?: "call" | "id" | "none";
  file?: File | null;
}) {
  /**
   * Single-submit onboarding. Sends multipart/form-data with:
   *  - data: JSON string of the payload without the file
   *  - file: optional UploadFile for ID document
   */
  const form = new FormData();
  const { file, ...rest } = payload;
  form.append("data", JSON.stringify(rest));
  if (file) {
    form.append("file", file);
  }
  const res = await authedFetch(`${API_BASE_URL}/onboarding/complete`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to complete onboarding"));
  return res.json();
}
