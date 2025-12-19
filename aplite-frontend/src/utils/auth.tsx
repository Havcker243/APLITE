import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthResponse, logout as apiLogout, User, fetchProfile } from "./api";
import { setAuthToken } from "./api";

type AuthContextType = {
  user: User | null;
  token: string | null;
  ready: boolean;
  login: (payload: AuthResponse) => void;
  logout: () => void;
  needsOnboarding: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  ready: false,
  login: () => undefined,
  logout: () => undefined,
  needsOnboarding: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Try to hydrate session from stored token first; fall back to cookie.
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("aplite_token") : null;
    if (stored) {
      setToken(stored);
      setAuthToken(stored);
    }
    fetchProfile()
      .then((u) => {
        setUser(u);
        setToken((prev) => prev || "cookie");
        setNeedsOnboarding(false);
      })
      .catch(() => {
        setUser(null);
        setToken(null);
        setNeedsOnboarding(false);
      })
      .finally(() => setReady(true));
  }, []);

  const handleLogin = (payload: AuthResponse) => {
    setUser(payload.user);
    setToken(payload.token || "cookie");
    setNeedsOnboarding(Boolean(payload.needs_onboarding));
    if (payload.token) setAuthToken(payload.token);
  };

  const handleLogout = () => {
    void apiLogout().finally(() => {
      setUser(null);
      setToken(null);
      setNeedsOnboarding(false);
      setAuthToken(null);
    });
  };

  return <AuthContext.Provider value={{ user, token, ready, login: handleLogin, logout: handleLogout, needsOnboarding }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
