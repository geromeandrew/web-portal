import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PrepaidRoute from "../src/routes/PrepaidRoute";
import { createPrepaidFixture } from "./fixtures/prepaidFixture";

const api = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  downloadApiFile: vi.fn(),
}));
vi.mock("../src/lib/apiClient", () => ({
  ...api,
  ApiClientError: class extends Error {},
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it("shows prepaid guidelines before run data is ready and preserves the upload lock", async () => {
  const fixture = createPrepaidFixture("upload");
  let resolveWorkspace!: (value: unknown) => void;
  let resolveSources!: (value: unknown) => void;
  api.apiRequest.mockImplementation((path: string, options?: RequestInit) => {
    if (path.endsWith("/workspace"))
      return new Promise((resolve) => {
        resolveWorkspace = resolve;
      });
    if (path.endsWith("/sources"))
      return new Promise((resolve) => {
        resolveSources = resolve;
      });
    return fixture.request(path, options);
  });
  const container = document.createElement("div"),
    root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter
          initialEntries={["/prepaid/file-upload"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/prepaid/:section" element={<PrepaidRoute />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toContain("Loading workspace...");
    expect(container.textContent).toContain("Loading file guidelines...");
    const state = await fixture.request<any>("/workflows/prepaid/workspace");
    await act(async () =>
      resolveWorkspace({ ...state, run: { id: "fixture-run" } }),
    );
    expect(container.textContent).toContain("KE24.XLSX");
    expect(container.textContent).not.toContain("Loading file guidelines...");
    expect(
      container.querySelector<HTMLButtonElement>(".pp-dropzone")?.disabled,
    ).toBe(true);
    expect(container.textContent).toContain("Loading workspace...");
    await act(async () => resolveSources(state.sources));
    expect(
      container.querySelector<HTMLButtonElement>(".pp-dropzone")?.disabled,
    ).toBe(false);
    expect(container.textContent).not.toContain("Loading workspace...");
    expect(
      api.apiRequest.mock.calls.some(
        ([path]) => path === "/processing-pipelines",
      ),
    ).toBe(false);
  } finally {
    await act(async () => root.unmount());
    api.apiRequest.mockReset();
  }
});
