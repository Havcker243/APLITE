import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthResponse, logout as apiLogout, setAuthToken, User } from "./api";

type AuthContextType = {
  user: User | null;
  token: string | null;
  ready: boolean;
  login: (payload: AuthResponse) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  ready: false,
  login: () => undefined,
  logout: () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("aplite_auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { token: string; user: User };
        setUser(parsed.user);
        setToken(parsed.token);
        setAuthToken(parsed.token);
      } catch {
        window.localStorage.removeItem("aplite_auth");
      }
    }
    setReady(true);
  }, []);

  const handleLogin = (payload: AuthResponse) => {
    setUser(payload.user);
    setToken(payload.token);
    setAuthToken(payload.token);
    window.localStorage.setItem("aplite_auth", JSON.stringify(payload));
  };

  const handleLogout = () => {
    void apiLogout().finally(() => {
      setUser(null);
      setToken(null);
      setAuthToken(null);
      window.localStorage.removeItem("aplite_auth");
    });
  };

  return <AuthContext.Provider value={{ user, token, ready, login: handleLogin, logout: handleLogout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
