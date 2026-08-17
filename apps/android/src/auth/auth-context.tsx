/**
 * Auth provider — owns session state for Scholar.
 *
 * On launch it restores the session from secure storage and validates it
 * against GET /api/auth/session. Exposes login/register/logout backed by the
 * existing Scholar backend. The same account works on web and Android — there
 * is no second user database.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError, onSessionExpired } from "@/api/client";
import * as authApi from "@/api/auth";
import { configuredApiUrl, getApiUrl } from "@/api/config";
import { setLastEmail } from "@/storage/app-storage";
import type { AuthUser, SessionResponse, SessionUser } from "@/types/api";
import { cancelAllLamRequests } from "@/api/lam";

export type AuthStatus = "restoring" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  session: SessionResponse | null;
  apiUrl: string;
  apiConfigured: boolean;
  /** Last auth-related error message (e.g. unreachable server). */
  error: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [apiUrl, setApiUrl] = useState<string>(configuredApiUrl());
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback((value: SessionResponse) => {
    if (value.authenticated && value.user) {
      setUser(value.user);
      setSession(value);
      setStatus("signedIn");
      setError(null);
    } else {
      setUser(null);
      setSession(value);
      setStatus("signedOut");
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const value = await authApi.getSession();
    applySession(value);
  }, [applySession]);

  // Restore session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await getApiUrl();
      if (!cancelled) setApiUrl(url);
      try {
        const value = await authApi.getSession();
        if (cancelled) return;
        applySession(value);
      } catch (caught) {
        if (cancelled) return;
        setUser(null);
        setSession(null);
        setStatus("signedOut");
        setError(caught instanceof ApiError ? caught.message : "Cannot reach Scholar.");
      }
    })();
    const unsubscribe = onSessionExpired(() => {
      cancelAllLamRequests();
      void authApi.clearLocalSession();
      setUser(null);
      setSession(null);
      setStatus("signedOut");
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const value = await authApi.login(email, password);
      await setLastEmail(email.trim());
      await authApi.getSession().then(applySession);
      return value;
    },
    [applySession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const value = await authApi.register(name, email, password);
      await setLastEmail(email.trim());
      await authApi.getSession().then(applySession);
      return value;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    cancelAllLamRequests();
    await authApi.logout();
    setUser(null);
    setSession(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      session,
      apiUrl,
      apiConfigured: apiUrl.length > 0,
      error,
      login,
      register,
      logout,
      refreshSession,
    }),
    [status, user, session, apiUrl, error, login, register, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
