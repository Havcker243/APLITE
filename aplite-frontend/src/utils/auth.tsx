import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthResponse, logout as apiLogout, User, fetchProfileDetails } from "./api";
import { setAuthToken } from "./api";

type AuthContextType = {
  user: User | null;
  token: string | null;
  ready: boolean;
  accessLevel: "ONBOARDING" | "ACTIVE" | "SUSPENDED";
  profileReady: boolean;
  login: (payload: AuthResponse) => void;
  logout: () => void;
  needsOnboarding: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  ready: false,
  profileReady: false,
  accessLevel: "ONBOARDING",
  login: () => undefined,
  logout: () => undefined,
  needsOnboarding: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [accessLevel, setAccessLevel] = useState<"ONBOARDING" | "ACTIVE" | "SUSPENDED">("ONBOARDING");
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    // Try to hydrate session from stored token first; fall back to cookie.
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("aplite_token") : null;
    if (stored) {
      setToken(stored);
      setAuthToken(stored);
    }
    fetchProfileDetails()
      .then((details) => {
        setUser(details.user);
        setToken((prev) => prev || "cookie");
        const onboardingState = String(details.onboarding_state || "NOT_STARTED").toUpperCase();
        const needs = onboardingState !== "VERIFIED";
        setNeedsOnboarding(needs);
        setAccessLevel((details.access_level as any) || (needs ? "ONBOARDING" : "ACTIVE"));
      })
      .catch(() => {
        setUser(null);
        setToken(null);
        setNeedsOnboarding(false);
        setAccessLevel("ONBOARDING");
      })
      .finally(() => {
        setReady(true);
        setProfileReady(true);
      });
  }, []);

  const handleLogin = (payload: AuthResponse) => {
    setUser(payload.user);
    setToken(payload.token || "cookie");
    setNeedsOnboarding(Boolean(payload.needs_onboarding));
    setAccessLevel(payload.needs_onboarding ? "ONBOARDING" : "ACTIVE");
    setProfileReady(false); // will refresh on next details fetch
    if (payload.token) setAuthToken(payload.token);
  };

  const handleLogout = () => {
    void apiLogout().finally(() => {
      setUser(null);
      setToken(null);
      setNeedsOnboarding(false);
      setAuthToken(null);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem("aplite_token");
          window.sessionStorage.removeItem("aplite_onboarding_session_v2"); // clear onboarding draft/progress
        } catch {
          // ignore storage errors on logout
        }
        window.location.href = "/login";
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, ready, login: handleLogin, logout: handleLogout, needsOnboarding, accessLevel, profileReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
