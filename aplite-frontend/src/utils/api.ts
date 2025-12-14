const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

let authToken: string | null = null;

export type BusinessPayload = {
  legal_name: string;
  ein: string;
  business_type: string;
  website?: string;
  address: string;
  country: string;
  bank_name: string;
  ach_routing: string;
  ach_account: string;
  wire_routing: string;
  wire_account: string;
};

export type ResolvePayload = {
  upi: string;
  rail: "ACH" | "WIRE_DOM";
};

export type BusinessSummary = {
  id: number;
  upi: string;
  legal_name: string;
  verification_status: string;
  created_at: string;
  parent_upi?: string;
};

export type User = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  master_upi: string;
  created_at?: string;
};

export type AuthResponse = {
  token: string;
  user: User;
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
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to log in");
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
