import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import AppShell from "../src/components/AppShell";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const auth = vi.hoisted(() => ({
  logout: vi.fn<() => Promise<void>>(),
  user: {
    id: "user-1",
    email: "juan.miguel@globe.com",
    displayName: "Juan Miguel Dela Cruz",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
}));

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => auth,
}));

describe("AppShell", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    auth.logout.mockReset().mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("offers workspace navigation, the administrator placeholder, and sign-out", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Outlet />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    const workspaceButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) =>
      button.textContent?.includes("Workspace"),
    ) as HTMLButtonElement;
    await act(async () => workspaceButton.click());
    expect(
      container.querySelector(
        'a[href="/processing-pipelines?workspace=bss-bill-cycle-globe"]',
      )?.textContent,
    ).toBe("BSS Bill Cycle - Globe");

    const administratorButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) =>
      button.textContent?.includes("Administrator"),
    ) as HTMLButtonElement;
    await act(async () => administratorButton.click());
    expect(container.textContent).toContain("Coming soon");

    const signOutButton = container.querySelector(
      'button[aria-label="Sign out"]',
    ) as HTMLButtonElement;
    await act(async () => signOutButton.click());
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Juan Miguel Dela Cruz");
  });
});
