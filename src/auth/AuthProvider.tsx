import { useOktaAuth } from "@okta/okta-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserDto } from "../lib/apiTypes";
import { apiRequest } from "../lib/apiClient";

type AuthContextValue = {
  user: UserDto | null;
  ready: boolean;
  login(originalUri?: string): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const previewUser: UserDto = {
  id: "ui-preview-user",
  email: "juan.miguel.delacruz@globe.com",
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * Temporary UI-review provider. It deliberately mirrors AuthProvider's public
 * contract so no route needs special-case authentication logic.
 */
export function TemporaryAuthBypassProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready: true,
      async login() {
        setUser(previewUser);
      },
      async logout() {
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { oktaAuth, authState } = useOktaAuth();
  const [user, setUser] = useState<UserDto | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!authState) {
      setProfileReady(false);
      return () => {
        active = false;
      };
    }
    if (!authState.isAuthenticated) {
      setUser(null);
      setProfileReady(true);
      return () => {
        active = false;
      };
    }

    setProfileReady(false);
    void apiRequest<{ user: UserDto }>("/auth/me")
      .then(({ user: current }) => {
        if (active) setUser(current);
      })
      .catch(async () => {
        if (!active) return;
        setUser(null);
        await oktaAuth.tokenManager.clear();
      })
      .finally(() => {
        if (active) setProfileReady(true);
      });
    return () => {
      active = false;
    };
  }, [authState, oktaAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready: Boolean(authState) && profileReady,
      async login(originalUri = "/") {
        await oktaAuth.signInWithRedirect({ originalUri });
      },
      async logout() {
        setUser(null);
        await oktaAuth.signOut();
      },
    }),
    [authState, oktaAuth, profileReady, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
