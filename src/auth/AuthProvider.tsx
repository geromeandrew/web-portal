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
