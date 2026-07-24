import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserDto } from "../../shared/api";
import { apiRequest, setAccessToken } from "../lib/apiClient";

type AuthContextValue = {
  user: UserDto | null;
  ready: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void apiRequest<{ user: UserDto }>("/auth/me").then(({ user: current }) => setUser(current)).catch(() => setAccessToken(null)).finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    async login(email, password) {
      const response = await apiRequest<{ accessToken: string; user: UserDto }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setAccessToken(response.accessToken);
      setUser(response.user);
    },
    async logout() {
      try { await apiRequest<void>("/auth/logout", { method: "POST" }); } finally { setAccessToken(null); setUser(null); }
    },
    async changePassword(currentPassword, newPassword) {
      const response = await apiRequest<{ accessToken: string; user: UserDto }>("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      setAccessToken(response.accessToken);
      setUser(response.user);
    },
  }), [ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
