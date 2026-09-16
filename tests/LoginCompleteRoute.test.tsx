import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { UserDto } from "../src/lib/apiTypes";
import LoginCompleteRoute from "../src/routes/LoginCompleteRoute";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const auth = vi.hoisted(() => ({
  user: null as UserDto | null,
  ready: false,
  error: null as string | null,
}));

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => auth,
}));

function LoginDestination() {
  const location = useLocation();
  const error =
    typeof location.state === "object" &&
    location.state &&
    "authError" in location.state &&
    typeof location.state.authError === "string"
      ? location.state.authError
      : "";
  return <p>Login: {error}</p>;
}

describe("LoginCompleteRoute", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/login/complete"]}>
          <Routes>
            <Route path="/login/complete" element={<LoginCompleteRoute />} />
            <Route path="/" element={<p>Home</p>} />
            <Route path="/login" element={<LoginDestination />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  };

  beforeEach(() => {
    auth.user = null;
    auth.ready = false;
    auth.error = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("waits for provisioning before redirecting", async () => {
    await render();

    expect(container.textContent).toContain("Preparing your portal");
  });

  it("waits for Okta to restore tokens instead of briefly showing a login error", async () => {
    auth.ready = true;

    await render();

    expect(container.textContent).toContain("Preparing your portal");
  });

  it("redirects a provisioned user to the dashboard", async () => {
    auth.ready = true;
    auth.user = {
      id: "user-id",
      email: "person@example.com",
      displayName: "Person Example",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    await render();

    expect(container.textContent).toBe("Home");
  });

  it("returns provisioning failures to login with a retry message", async () => {
    auth.ready = true;
    auth.error = "We couldn't complete sign-in. Please try again.";

    await render();

    expect(container.textContent).toBe(
      "Login: We couldn't complete sign-in. Please try again.",
    );
  });
});
