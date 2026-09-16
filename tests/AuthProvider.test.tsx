import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AuthProvider, useAuth } from "../src/auth/AuthProvider";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

const okta = vi.hoisted(() => ({
  authState: { isAuthenticated: true },
  auth: {
    signOut: vi.fn<() => Promise<boolean>>(),
    tokenManager: {
      clear: vi.fn(),
      getTokensSync: vi.fn(),
    },
  },
  apiRequest: vi.fn(),
}));

vi.mock("@okta/okta-react", () => ({
  useOktaAuth: () => ({ authState: okta.authState, oktaAuth: okta.auth }),
}));

vi.mock("../src/auth/okta", () => ({
  oktaConfig: { postLogoutRedirectUri: "http://localhost:5173/logout" },
}));

vi.mock("../src/lib/apiClient", () => ({ apiRequest: okta.apiRequest }));

function AuthProbe() {
  const { logout, ready, user } = useAuth();
  return (
    <>
      <button type="button" onClick={() => void logout()}>
        Sign out
      </button>
      <output>{ready ? user?.email ?? "none" : "loading"}</output>
    </>
  );
}

describe("AuthProvider logout", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    okta.auth.signOut.mockReset();
    okta.auth.tokenManager.clear.mockReset();
    okta.auth.tokenManager.getTokensSync.mockReset();
    okta.apiRequest.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("does not restore a user when a profile request finishes during sign-out", async () => {
    const profile = deferred<{ user: { email: string } }>();
    const signOut = deferred<boolean>();
    const tokens = {
      accessToken: { accessToken: "access-token" },
      idToken: { idToken: "id-token" },
    };
    okta.apiRequest.mockReturnValue(profile.promise);
    okta.auth.signOut.mockReturnValue(signOut.promise);
    okta.auth.tokenManager.getTokensSync.mockReturnValue(tokens);

    await act(async () => {
      root.render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });

    await act(async () => {
      (container.querySelector("button") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(okta.auth.tokenManager.clear).toHaveBeenCalledOnce();
    expect(okta.auth.signOut).toHaveBeenCalledWith({
      ...tokens,
      clearTokensBeforeRedirect: true,
      postLogoutRedirectUri: "http://localhost:5173/logout",
    });
    expect(container.querySelector("output")?.textContent).toBe("loading");

    await act(async () => {
      profile.resolve({ user: { email: "signed-in@globe.com" } });
      await profile.promise;
    });

    expect(container.querySelector("output")?.textContent).toBe("loading");

    await act(async () => {
      signOut.resolve(true);
      await signOut.promise;
    });
  });
});
