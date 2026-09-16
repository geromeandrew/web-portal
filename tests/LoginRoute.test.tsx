import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginRoute from "../src/routes/LoginRoute";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const auth = vi.hoisted(() => ({
  login: vi.fn<() => Promise<void>>(),
  logout: vi.fn<() => Promise<void>>(),
  user: null,
}));

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => auth,
}));

describe("LoginRoute", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderLogin = async (entry = "/login") => {
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[entry]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/" element={<p>Home</p>} />
          </Routes>
        </MemoryRouter>,
      );
    });
  };

  beforeEach(() => {
    auth.user = null;
    auth.login.mockReset().mockResolvedValue(undefined);
    auth.logout.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders the ES-ATP sign-in experience", async () => {
    await renderLogin();

    expect(container.querySelector("h1")?.textContent).toBe("ES-ATP");
    expect(container.textContent).toContain(
      "Automation and Transformation Platform",
    );
    expect(
      container.querySelector('img[alt="Person using a laptop"]'),
    ).not.toBeNull();
    expect(container.querySelector("button")?.textContent).toContain(
      "Log in with OKTA SSO",
    );
  });

  it("starts Okta sign-in with the requested return path", async () => {
    await renderLogin({
      pathname: "/login",
      state: { from: "/processing-pipelines" },
    } as never);

    await act(async () => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });

    expect(auth.login).toHaveBeenCalledWith("/processing-pipelines");
  });

  it("restores the sign-in button and announces an error when sign-in cannot start", async () => {
    auth.login.mockRejectedValueOnce(new Error("Okta unavailable"));
    await renderLogin();

    await act(async () => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Unable to start Okta sign-in. Please try again.",
    );
    expect(
      (container.querySelector("button") as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("shows a safe error after a failed callback or profile provisioning request", async () => {
    await renderLogin({
      pathname: "/login",
      state: { authError: "We couldn't complete sign-in. Please try again." },
    } as never);

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "We couldn't complete sign-in. Please try again.",
    );
  });
});
