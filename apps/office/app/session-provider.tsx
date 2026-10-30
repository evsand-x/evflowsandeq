"use client";

import type { AuthPrincipal } from "@evflow/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiRequest, resetCsrf } from "../lib/api";
import { setFormatterDefaults } from "../lib/format";
import { fetchPreferences, preferencesKey } from "../lib/settings";

type SessionState = "loading" | "authenticated" | "anonymous" | "error";
type SessionContextValue = {
  state: SessionState;
  principal: AuthPrincipal | null;
  reload: () => Promise<boolean>;
  logout: () => Promise<void>;
};
const SessionContext = createContext<SessionContextValue | null>(null);
const channelName = "evflow-session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 30_000 }, mutations: { retry: false } },
      }),
  );
  const [principal, setPrincipal] = useState<AuthPrincipal | null>(null);
  const [state, setState] = useState<SessionState>("loading");
  const clearPrivateState = useCallback(async () => {
    await client.cancelQueries();
    client.clear();
    setPrincipal(null);
    setState("anonymous");
    resetCsrf();
  }, [client]);
  const reload = useCallback(async () => {
    setState("loading");
    try {
      const result = await apiRequest<{ data: AuthPrincipal }>("/auth/me");
      client.clear();
      // Number format from Setting; a failure keeps the Rupiah defaults and never blocks sign-in.
      const preferences = await fetchPreferences().catch(() => null);
      if (preferences?.number_format) setFormatterDefaults(preferences.number_format);
      if (preferences) client.setQueryData(preferencesKey, preferences);
      setPrincipal(result.data);
      setState("authenticated");
      return true;
    } catch (error) {
      await clearPrivateState();
      if (!(error instanceof ApiError && error.status === 401)) setState("error");
      return false;
    }
  }, [clearPrivateState, client]);
  const logout = useCallback(async () => {
    await apiRequest<void>("/auth/logout", { method: "POST" });
    await clearPrivateState();
    const channel = new BroadcastChannel(channelName);
    channel.postMessage("logout");
    channel.close();
    window.location.assign("/login");
  }, [clearPrivateState]);
  useEffect(() => {
    void reload();
    const channel = new BroadcastChannel(channelName);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === "logout") {
        void clearPrivateState();
        window.location.assign("/login?session=ended");
      }
      if (event.data === "login") void reload();
    };
    return () => channel.close();
  }, [clearPrivateState, reload]);
  const value = useMemo(
    () => ({ state, principal, reload, logout }),
    [state, principal, reload, logout],
  );
  return (
    <QueryClientProvider client={client}>
      <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
    </QueryClientProvider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("SessionProvider belum tersedia.");
  return context;
}

export function notifyLogin() {
  const channel = new BroadcastChannel(channelName);
  channel.postMessage("login");
  channel.close();
}
