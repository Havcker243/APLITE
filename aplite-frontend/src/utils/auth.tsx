/**
 * Auth context and provider for the frontend UI.
 * Keeps the canonical user/profile snapshot and refreshes from the backend.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, fetchProfileDetails, ProfileDetailsResponse } from "./api";
import { setAuthToken, setCsrfToken } from "./api";
import { getSupabaseClient } from "./supabase";

type AuthContextType = {
  user: User | null;
  token: string | null;
  profile: ProfileDetailsResponse | null;
  emailConfirmed: boolean;
  userEmail: string | null;
  loading: boolean;
  isBootstrapping: boolean;
  isRefreshing: boolean;
  login: (accessToken: string) => void;
  logout: () => void;
  refreshProfile: (options?: { silent?: boolean }) => Promise<ProfileDetailsResponse | null>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  profile: null,
  emailConfirmed: true,
  userEmail: null,
  loading: true,
  isBootstrapping: true,
  isRefreshing: false,
  login: () => undefined,
  logout: () => undefined,
  refreshProfile: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileDetailsResponse | null>(null);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pull the canonical profile snapshot from the server (single source of truth).
  const refreshProfile = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setIsRefreshing(true);
    try {
      const details = await fetchProfileDetails();
      // Server snapshot is canonical; update all auth-facing state from it.
      setUser(details.user);
      setProfile(details);
      setToken((prev) => prev || null);
      return details;
    } catch {
      setUser(null);
      setProfile(null);
      setToken(null);
      setCsrfToken(null);
      return null;
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const stored = (typeof window !== "undefined" && window.localStorage.getItem("aplite_auth_storage")) || "local";
    const supabase = getSupabaseClient(stored === "session" ? "session" : "local");
    if (!supabase) {
      setIsBootstrapping(false);
      return;
    }

    const boot = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token || null;
        if (accessToken) {
          setToken(accessToken);
          setAuthToken(accessToken);
          const sessionUser = data.session?.user;
          const confirmed = Boolean(sessionUser?.email_confirmed_at || sessionUser?.confirmed_at);
          setEmailConfirmed(confirmed);
          setUserEmail(sessionUser?.email || null);
          await refreshProfile({ silent: true });
        } else {
          setEmailConfirmed(true);
          setUserEmail(null);
        }
      } finally {
        setIsBootstrapping(false);
      }
    };

    void boot();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token || null;
      if (accessToken) {
        setToken(accessToken);
        setAuthToken(accessToken);
        const confirmed = Boolean(session?.user?.email_confirmed_at || session?.user?.confirmed_at);
        setEmailConfirmed(confirmed);
        setUserEmail(session?.user?.email || null);
        void refreshProfile({ silent: true });
      } else {
        setUser(null);
        setProfile(null);
        setToken(null);
        setAuthToken(null);
        setCsrfToken(null);
        setEmailConfirmed(true);
        setUserEmail(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = (accessToken: string) => {
    setToken(accessToken);
    setAuthToken(accessToken);
    void refreshProfile();
  };

  const handleLogout = () => {
    const supabase = getSupabaseClient();
    const signOut = supabase ? supabase.auth.signOut() : Promise.resolve();
    void signOut.finally(() => {
      setUser(null);
      setToken(null);
      setProfile(null);
      setAuthToken(null);
      setCsrfToken(null);
      setEmailConfirmed(true);
      setUserEmail(null);
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
    <AuthContext.Provider
      value={{
        user,
        token,
        profile,
        emailConfirmed,
        userEmail,
        loading: isBootstrapping,
        isBootstrapping,
        isRefreshing,
        login: handleLogin,
        logout: handleLogout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
