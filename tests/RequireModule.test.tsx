import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireModule } from "../src/auth/RequireModule";
import { RequireAdmin } from "../src/auth/RequireAdmin";

const auth = vi.hoisted(() => ({
  ready: true,
  user: { isAdmin: false, modules: [] as { moduleId: string }[] },
}));
vi.mock("../src/auth/AuthProvider", () => ({ useAuth: () => auth }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("workspace route access", () => {
  it.each([
    { modules: [], admin: false, allowed: false },
    { modules: ["bss_eom_bayn"], admin: false, allowed: false },
    { modules: ["bss_eom_glob"], admin: false, allowed: true },
    { modules: [], admin: true, allowed: false },
  ])(
    "requires the API's effective module assignment: %j",
    async ({ modules, admin, allowed }) => {
      auth.user = {
        isAdmin: admin,
        modules: modules.map((moduleId) => ({ moduleId })),
      };
      const container = document.createElement("div"),
        root = createRoot(container);
      await act(async () =>
        root.render(
          <MemoryRouter
            initialEntries={["/workspace"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <Routes>
              <Route path="/" element={<p>Dashboard</p>} />
              <Route
                path="/workspace"
                element={
                  <RequireModule moduleId="bss_eom_glob">
                    <p>Workspace</p>
                  </RequireModule>
                }
              />
            </Routes>
          </MemoryRouter>,
        ),
      );
      expect(container.textContent).toBe(allowed ? "Workspace" : "Dashboard");
      await act(async () => root.unmount());
    },
  );

  it("denies administrator routes to a business user with module access", async () => {
    auth.user = { isAdmin: false, modules: [{ moduleId: "bss_eom_glob" }] };
    const container = document.createElement("div"),
      root = createRoot(container);
    await act(async () =>
      root.render(
        <MemoryRouter
          initialEntries={["/admin"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/" element={<p>Dashboard</p>} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <p>Administrator</p>
                </RequireAdmin>
              }
            />
          </Routes>
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toBe("Dashboard");
    await act(async () => root.unmount());
  });
});
