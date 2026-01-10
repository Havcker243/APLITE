/**
 * Global app data cache for frequently used resources.
 * Keeps shared data alive across route changes to avoid reload flicker.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchPublicClients, listAccounts, listChildUpis } from "./api";
import { useAuth } from "./auth";

type Account = any;
type ChildUpi = any;
type Client = any;

type AppDataContextType = {
  accounts: Account[];
  upis: ChildUpi[];
  clients: Client[];
  lastFetched: {
    accounts: Date | null;
    upis: Date | null;
    clients: Date | null;
  };
  loading: {
    accounts: boolean;
    upis: boolean;
    clients: boolean;
  };
  refreshAccounts: (options?: { force?: boolean }) => Promise<Account[]>;
  refreshUpis: (options?: { force?: boolean }) => Promise<ChildUpi[]>;
  refreshClients: (options?: { force?: boolean }) => Promise<Client[]>;
  clearCache: () => void;
};

const AppDataContext = createContext<AppDataContextType>({
  accounts: [],
  upis: [],
  clients: [],
  lastFetched: { accounts: null, upis: null, clients: null },
  loading: { accounts: false, upis: false, clients: false },
  refreshAccounts: async () => [],
  refreshUpis: async () => [],
  refreshClients: async () => [],
  clearCache: () => undefined,
});

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  /** App-wide cache provider for accounts, UPIs, and public clients. */
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [upis, setUpis] = useState<ChildUpi[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [lastFetched, setLastFetched] = useState({
    accounts: null as Date | null,
    upis: null as Date | null,
    clients: null as Date | null,
  });
  const [loading, setLoading] = useState({
    accounts: false,
    upis: false,
    clients: false,
  });

  useEffect(() => {
    if (!token) {
      setAccounts([]);
      setUpis([]);
      setClients([]);
      setLastFetched({ accounts: null, upis: null, clients: null });
      setLoading({ accounts: false, upis: false, clients: false });
    }
  }, [token]);

  const refreshAccounts = useCallback(async (options?: { force?: boolean }) => {
    /** Refresh payment accounts with a simple freshness check. */
    if (!token) return [];
    if (!options?.force && lastFetched.accounts && accounts.length) return accounts;
    if (!options?.force && loading.accounts) return accounts;
    setLoading((prev) => ({ ...prev, accounts: true }));
    try {
      const data = await listAccounts();
      setAccounts(data);
      setLastFetched((prev) => ({ ...prev, accounts: new Date() }));
      return data;
    } finally {
      setLoading((prev) => ({ ...prev, accounts: false }));
    }
  }, [accounts, lastFetched.accounts, loading.accounts, token]);

  const refreshUpis = useCallback(async (options?: { force?: boolean }) => {
    /** Refresh child UPIs with a simple freshness check. */
    if (!token) return [];
    if (!options?.force && lastFetched.upis && upis.length) return upis;
    if (!options?.force && loading.upis) return upis;
    setLoading((prev) => ({ ...prev, upis: true }));
    try {
      const data = await listChildUpis({ limit: 200 });
      setUpis(data);
      setLastFetched((prev) => ({ ...prev, upis: new Date() }));
      return data;
    } finally {
      setLoading((prev) => ({ ...prev, upis: false }));
    }
  }, [lastFetched.upis, loading.upis, token, upis]);

  const refreshClients = useCallback(async (options?: { force?: boolean }) => {
    /** Refresh the public clients directory. */
    if (!options?.force && lastFetched.clients && clients.length) return clients;
    if (!options?.force && loading.clients) return clients;
    setLoading((prev) => ({ ...prev, clients: true }));
    try {
      const data = await fetchPublicClients();
      setClients(data);
      setLastFetched((prev) => ({ ...prev, clients: new Date() }));
      return data;
    } finally {
      setLoading((prev) => ({ ...prev, clients: false }));
    }
  }, [clients, lastFetched.clients, loading.clients]);

  const clearCache = useCallback(() => {
    /** Clear all cached app data. */
    setAccounts([]);
    setUpis([]);
    setClients([]);
    setLastFetched({ accounts: null, upis: null, clients: null });
  }, []);

  const value = useMemo(
    () => ({
      accounts,
      upis,
      clients,
      lastFetched,
      loading,
      refreshAccounts,
      refreshUpis,
      refreshClients,
      clearCache,
    }),
    [accounts, upis, clients, lastFetched, loading, refreshAccounts, refreshUpis, refreshClients, clearCache]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  /** Hook to access cached app data + refresh helpers. */
  return useContext(AppDataContext);
}
