"use client";

import * as React from "react";
import type { UserSummary } from "@sickdoc/shared";
import { getSession, login as apiLogin, logout as apiLogout, onSessionChange, restoreSession } from "@/lib/api-client";

interface AuthContextValue {
  user: UserSummary | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<UserSummary>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<UserSummary | null>(() => getSession()?.user ?? null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onSessionChange((next) => setUser(next?.user ?? null));
    restoreSession()
      .catch(() => null)
      .finally(() => setLoading(false));
    return unsubscribe;
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const next = await apiLogin(email, password);
    setUser(next.user);
    return next.user;
  }, []);

  const signOut = React.useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = React.useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
