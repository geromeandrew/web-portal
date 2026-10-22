import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import PrepaidRoute from "../src/routes/PrepaidRoute";

const api = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  downloadApiFile: vi.fn(),
}));
vi.mock("../src/lib/apiClient", () => api);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it("shows prepaid guidelines before storage is ready and preserves the upload lock", async () => {
  let resolveFiles!: (value: unknown) => void;
  let resolveState!: (value: unknown) => void;
  api.apiRequest.mockImplementation((path: string) => {
    if (path === "/workflows/prepaid/state")
      return new Promise((resolve) => {
        resolveState = resolve;
      });
    if (path.endsWith("/files"))
      return new Promise((resolve) => {
        resolveFiles = resolve;
      });
    throw new Error(`Unexpected request: ${path}`);
  });
  const container = document.createElement("div"),
    root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <PrepaidRoute pipelineCode="prepaid_reclass" />
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toContain("Loading workspace...");
    expect(container.textContent).toContain("Loading file guidelines...");
    await act(async () =>
      resolveState({
        egLayout: { rows: [] },
        sgLayout: { rows: [] },
        allocation: { rows: [] },
        jv: { rows: [] },
        uploads: [],
        sourceFiles: { expected: ["CALLCARD_SG.XLSX"] },
      }),
    );
    expect(container.textContent).toContain("CALLCARD_SG.XLSX");
    expect(container.textContent).not.toContain("Loading file guidelines...");
    const zone = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Drop files here"),
    )!;
    expect(zone.disabled).toBe(true);
    await act(async () => resolveFiles({ configured: true, files: [] }));
    expect(container.textContent).not.toContain("Loading workspace...");
    expect(zone.disabled).toBe(false);
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
