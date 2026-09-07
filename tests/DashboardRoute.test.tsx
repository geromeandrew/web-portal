import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import DashboardRoute from "../src/routes/DashboardRoute";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const auth = vi.hoisted(() => ({
  user: { id: "user-1", email: "juan.miguel@globe.com", createdAt: "2026-01-01T00:00:00.000Z" },
}));

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => auth,
}));

describe("DashboardRoute", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders the greeting and all workspace actions", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <DashboardRoute />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Hello, Juan!");
    expect(container.querySelectorAll("article")).toHaveLength(6);
    expect(container.textContent).toContain("BSS Bill Cycle - Globe");
    expect(container.textContent).toContain("Prepaid Re-Class");
    expect(container.querySelector('a[href="/processing-pipelines?workspace=bss-bill-cycle-globe"]')?.textContent).toBe("Open workspace");
    expect(container.querySelector('a[href="/memo/file-upload"]')?.textContent).toBe("Open workspace");
  });
});
