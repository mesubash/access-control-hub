import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { request, setAccessToken, setUnauthorizedHandler } from "@/api/client";
import { authApi } from "@/api/resources";
import type { Identity, LoginResult, TokenResult } from "@/api/types";

/** What the login form does next. */
export type LoginStep = { next: "done" } | { next: "mfa"; challenge: string } | { next: "enroll" };

type AuthState = {
  identity: Identity | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<LoginStep>;
  verifyMfa: (challenge: string, code: string) => Promise<LoginStep>;
  logout: () => Promise<void>;
  setIdentity: (id: Identity | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    // Restore the session from spring-iam's refresh cookie, if there is one.
    let cancelled = false;
    request<TokenResult>("/api/auth/refresh", { method: "POST", skipAuthRetry: true })
      .then((t) => {
        if (cancelled || !t?.accessToken) return;
        setAccessToken(t.accessToken);
        setIdentity(t.identity);
      })
      .catch(() => {
        // No session: the guard sends the user to /login.
      })
      .finally(() => !cancelled && setIsBootstrapping(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAccessToken(null);
      setIdentity(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const finish = (r: LoginResult): LoginStep => {
    if ("status" in r && r.status === "MFA_REQUIRED")
      return { next: "mfa", challenge: r.challenge };
    if ("status" in r && r.status === "MFA_ENROLLMENT_REQUIRED") return { next: "enroll" };
    const t = r as TokenResult;
    setAccessToken(t.accessToken);
    setIdentity(t.identity);
    return { next: "done" };
  };

  const value = useMemo<AuthState>(
    () => ({
      identity,
      isAuthenticated: !!identity,
      isBootstrapping,
      setIdentity,
      login: async (email, password) => finish(await authApi.login(email, password)),
      verifyMfa: async (challenge, code) => finish(await authApi.mfaVerify(challenge, code)),
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          /* ignore */
        }
        setAccessToken(null);
        setIdentity(null);
      },
    }),
    [identity, isBootstrapping],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
