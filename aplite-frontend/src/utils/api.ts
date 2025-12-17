const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

let authToken: string | null = null;

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
