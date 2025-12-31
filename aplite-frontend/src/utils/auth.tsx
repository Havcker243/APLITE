/**
 * Auth context and provider for the frontend UI.
 * Keeps the canonical user/profile snapshot and refreshes from the backend.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthResponse, logout as apiLogout, User, fetchProfileDetails, ProfileDetailsResponse, fetchCsrfToken } from "./api";
import { setAuthToken, setCsrfToken } from "./api";

type AuthContextType = {
  user: User | null;
  token: string | null;
  profile: ProfileDetailsResponse | null;
  loading: boolean;
  login: (payload: AuthResponse) => void;
  logout: () => void;
  refreshProfile: () => Promise<ProfileDetailsResponse | null>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  profile: null,
  loading: true,
  login: () => undefined,
  logout: () => undefined,
  refreshProfile: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Pull the canonical profile snapshot from the server (single source of truth).
  const refreshProfile = async () => {
    setLoading(true);
    try {
      const details = await fetchProfileDetails();
      // Server snapshot is canonical; update all auth-facing state from it.
      setUser(details.user);
      setProfile(details);
      setToken((prev) => prev || "cookie");
      // CSRF token is required for cookie-based write requests.
      const csrf = await fetchCsrfToken();
      setCsrfToken(csrf);
      return details;
    } catch {
      setUser(null);
      setProfile(null);
      setToken(null);
      setCsrfToken(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Rely on cookie-based auth; refreshProfile will set token to "cookie" when valid.
    void refreshProfile();
  }, []);

  const handleLogin = (payload: AuthResponse) => {
    setUser(payload.user);
    // Token is only used for API clients; UI relies on HttpOnly cookies.
    setToken(payload.token || "cookie");
    if (payload.token) setAuthToken(payload.token);
    void refreshProfile();
  };

  const handleLogout = () => {
    void apiLogout().finally(() => {
      setUser(null);
      setToken(null);
      setProfile(null);
      setAuthToken(null);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem("aplite_onboarding_session_v2"); // clear onboarding draft/progress
        } catch {
          // ignore storage errors on logout
        }
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, profile, loading, login: handleLogin, logout: handleLogout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
