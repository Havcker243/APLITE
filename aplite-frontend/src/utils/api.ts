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
  authToken = token;
}

function authHeaders() {
  return authToken
    ? {
        Authorization: `Bearer ${authToken}`,
      }
    : {};
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
  throw new Error("Two-factor login now requires loginStart and loginVerify");
}

export async function loginStart(data: { email: string; password: string }): Promise<LoginStartResponse> {
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

export async function onboardBusiness(data: BusinessPayload) {
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

export async function fetchPublicClients(query?: string) {
  const params = new URLSearchParams();
  if (query) params.set("search", query);
  const res = await fetch(`${API_BASE_URL}/api/public/clients${params.toString() ? `?${params.toString()}` : ""}`);
  if (!res.ok) {
    throw new Error("Failed to load clients");
  }
  return res.json();
}

export async function updateProfile(data: {
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
  const res = await fetch(`${API_BASE_URL}/api/accounts`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error("Failed to load accounts");
  }
  return res.json();
}

export async function createAccount(data: AccountPayload) {
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
  const res = await fetch(`${API_BASE_URL}/onboarding/current`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await parseError(res, "Unable to load onboarding session"));
  return res.json();
}

export async function onboardingStep1(payload: OnboardingStep1Payload): Promise<OnboardingStep1Response> {
  const res = await fetch(`${API_BASE_URL}/onboarding/step-1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to save Step 1"));
  return res.json();
}

export async function onboardingStep2(payload: OnboardingStep2Payload) {
  const res = await fetch(`${API_BASE_URL}/onboarding/step-2`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to save Step 2"));
  return res.json();
}

export async function onboardingUploadId(file: File) {
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
  const res = await fetch(`${API_BASE_URL}/onboarding/step-3`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to save Step 3"));
  return res.json();
}

export async function onboardingStep4(payload: OnboardingStep4Payload) {
  const res = await fetch(`${API_BASE_URL}/onboarding/step-4`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to save Step 4"));
  return res.json();
}

export async function verifySendOtp(method: "email" | "sms") {
  const res = await fetch(`${API_BASE_URL}/verify/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ method }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to send OTP"));
  return res.json();
}

export async function verifyConfirmOtp(code: string) {
  const res = await fetch(`${API_BASE_URL}/verify/confirm-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to confirm OTP"));
  return res.json();
}

export async function verifyAvailableSlots() {
  const res = await fetch(`${API_BASE_URL}/verify/available-slots`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await parseError(res, "Unable to load slots"));
  return res.json() as Promise<{ slots: string[] }>;
}

export async function verifyScheduleCall(scheduled_at: string) {
  const res = await fetch(`${API_BASE_URL}/verify/schedule-call`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ scheduled_at }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Unable to schedule call"));
  return res.json();
}
