import { useOktaAuth } from "@okta/okta-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { UserDto } from "../lib/apiTypes";
import { apiRequest } from "../lib/apiClient";
import { oktaConfig } from "./okta";

type AuthContextValue = {
  user: UserDto | null;
  ready: boolean;
  error: string | null;
  login(originalUri?: string): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const previewUser: UserDto = {
  id: "ui-preview-user",
  email: "juan.miguel.delacruz@globe.com",
  displayName: "Juan Miguel Dela Cruz",
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * Temporary UI-review provider. It deliberately mirrors AuthProvider's public
 * contract so no route needs special-case authentication logic.
 */
export function TemporaryAuthBypassProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<UserDto | null>(null);
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready: true,
      error: null,
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
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const logoutInProgress = useRef(false);

  useEffect(() => {
    let active = true;
    if (isSigningOut) {
      // Changing this dependency invalidates any in-flight profile request so
      // it cannot restore the user while the Okta logout redirect is pending.
      setUser(null);
      setProfileReady(false);
      return () => {
        active = false;
      };
    }
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
    setError(null);
    void apiRequest<{ user: UserDto }>("/auth/me")
      .then(({ user: current }) => {
        if (active) setUser(current);
      })
      .catch(async () => {
        if (!active) return;
        setUser(null);
        setError("We couldn't complete sign-in. Please try again.");
        await oktaAuth.tokenManager.clear();
      })
      .finally(() => {
        if (active) setProfileReady(true);
      });
    return () => {
      active = false;
    };
  }, [authState, isSigningOut, oktaAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready: Boolean(authState) && profileReady && !isSigningOut,
      error,
      async login(originalUri = "/") {
        setError(null);
        await oktaAuth.signInWithRedirect({ originalUri });
      },
      async logout() {
        if (logoutInProgress.current) return;

        logoutInProgress.current = true;
        setIsSigningOut(true);
        setUser(null);
        setError(null);

        try {
          // Preserve the tokens only long enough for the SDK to revoke them
          // and construct the Okta logout request. Clearing storage first
          // ensures a redirected application cannot restore the portal session.
          const tokens = oktaAuth.tokenManager.getTokensSync();
          oktaAuth.tokenManager.clear();
          const signOutOptions = {
            accessToken: tokens.accessToken,
            idToken: tokens.idToken,
            postLogoutRedirectUri: oktaConfig.postLogoutRedirectUri,
            refreshToken: tokens.refreshToken,
            clearTokensBeforeRedirect: true,
          };

          // Okta revokes access and refresh tokens by default before ending
          // the SSO session and redirecting to the registered logout URI.
          try {
            await oktaAuth.signOut(signOutOptions);
          } catch {
            // A token-revocation outage must not leave the Okta SSO session
            // active. Retry the logout request without a second revocation.
            await oktaAuth.signOut({
              ...signOutOptions,
              revokeAccessToken: false,
              revokeRefreshToken: false,
            });
          }
        } catch {
          // Local credentials were already removed when possible. Let
          // RequireAuth take the user to the login screen rather than
          // restoring the dashboard.
          logoutInProgress.current = false;
          setIsSigningOut(false);
          setError("We couldn't complete sign-out at Okta. Please try again.");
        }
      },
    }),
    [authState, error, isSigningOut, oktaAuth, profileReady, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
