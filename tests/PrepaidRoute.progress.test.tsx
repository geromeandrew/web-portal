import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import PrepaidRoute from "../src/routes/PrepaidRoute";
import { createPrepaidFixture } from "./fixtures/prepaidFixture";
import * as prepaidApi from "../src/lib/prepaidApi";
const api = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  downloadApiFile: vi.fn(),
}));
vi.mock("../src/lib/apiClient", () => ({
  ...api,
  ApiClientError: class extends Error {
    status = 409;
  },
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root,
  container: HTMLDivElement,
  fixture: ReturnType<typeof createPrepaidFixture>;
beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  container.id = "root";
  document.body.append(container);
  root = createRoot(container);
  fixture = createPrepaidFixture("upload");
  api.apiRequest.mockImplementation(fixture.request);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});
const render = async (path = "/prepaid/file-upload") =>
  act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/prepaid/:section" element={<PrepaidRoute />} />
          <Route
            path="/prepaid/:section/:region/:variant"
            element={<PrepaidRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );
  });
const settle = async () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
const find = (label: string) =>
  Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent === label,
  )!;
it("keeps progress visible through extraction and final layout loading, then opens the ready review", async () => {
  let ready = false,
    resolveSg!: (value: unknown) => void;
  api.apiRequest.mockImplementation(
    async (path: string, options?: RequestInit) => {
      if (path.endsWith("/workspace"))
        return {
          session: {
            id: "session",
            version: 10,
            status: ready ? "ready" : "pending",
            run_id: null,
          },
          run: ready ? fixture.run : null,
          sources: fixture.sources,
          error: null,
        };
      if (path.endsWith("/workspace/extractions"))
        return {
          preparation: {
            id: "prep",
            status: "running",
            created_at: new Date(Date.now() - 70000).toISOString(),
          },
          expectedWorkflows: ["ke24", "callcard_eg"],
          executions: [
            { workflow: "ke24", status: "completed", preparation_id: "prep" },
            {
              workflow: "callcard_eg",
              status: "waiting",
              preparation_id: "prep",
            },
          ],
        };
      if (ready && path.endsWith("/layouts/sg"))
        return new Promise((resolve) => {
          resolveSg = resolve;
        });
      return fixture.request(path, options);
    },
  );
  await render();
  await settle();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "1 of 2 reports extracted",
  );
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "01:10",
  );
  expect(container.hasAttribute("inert")).toBe(true);
  await act(async () =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(find("View processing progress")).toBeDefined();
  expect(container.hasAttribute("inert")).toBe(false);

  // Switching workspaces unmounts the route while the server run stays active.
  await act(async () => root.render(<h1>Bill Cycles</h1>));
  await render();
  await settle();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "1 of 2 reports extracted",
  );
  ready = true;
  fixture.layouts.eg.imported = true;
  fixture.layouts.sg.imported = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Preparing your review tables",
  );
  await act(async () => resolveSg(fixture.layouts.sg));
  await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(container.hasAttribute("inert")).toBe(false);
  expect(container.textContent).toContain("EG Layout Review");
  expect(container.textContent).not.toContain("Import processed sources");
});
it("releases the progress dialog on a preparation failure and keeps its error visible", async () => {
  let failed = false;
  api.apiRequest.mockImplementation(
    async (path: string, options?: RequestInit) => {
      if (path.endsWith("/workspace"))
        return {
          session: {
            id: "session",
            version: 10,
            status: failed ? "failed" : "pending",
            run_id: null,
          },
          run: null,
          sources: fixture.sources,
          error: failed ? "One source report could not be read." : null,
        };
      if (path.endsWith("/workspace/extractions"))
        return { preparation: null, executions: [] };
      return fixture.request(path, options);
    },
  );
  await render();
  await settle();
  failed = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "One source report could not be read",
  );
  expect(container.hasAttribute("inert")).toBe(false);
});
it("retains the original inline upload progress and per-file cancellation without an upload modal", async () => {
  let signal: AbortSignal;
  let progress!: (percent: number) => void;
  vi.spyOn(prepaidApi, "uploadSource").mockImplementation(
    async (_run, _code, _file, current, onProgress) => {
      signal = current;
      progress = onProgress;
      return new Promise((_resolve, reject) =>
        current.addEventListener(
          "abort",
          () => reject(new DOMException("Cancelled", "AbortError")),
          { once: true },
        ),
      );
    },
  );
  await render();
  await settle();
  await act(async () => {
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [new File(["test"], "KE24.XLSX")],
      configurable: true,
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(container.hasAttribute("inert")).toBe(false);
  await act(async () => progress(50));
  expect(document.querySelector("progress")?.getAttribute("value")).toBe("50");
  expect(container.querySelectorAll(".pp-file progress")).toHaveLength(1);
  await act(async () => find("Cancel").click());
  await settle();
  expect(signal!.aborted).toBe(true);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("keeps simultaneous uploads inline, then blocks the workspace only when server preparation starts", async () => {
  let pending = false;
  const transfers = new Map<
    string,
    {
      progress: (percent: number) => void;
      resolve: (value: { id: string }) => void;
    }
  >();
  vi.spyOn(prepaidApi, "uploadSource").mockImplementation(
    async (_run, code, _file, _signal, onProgress) =>
      new Promise((resolve) => {
        transfers.set(code, { progress: onProgress, resolve });
      }),
  );
  api.apiRequest.mockImplementation(
    async (path: string, options?: RequestInit) => {
      if (path.endsWith("/workspace"))
        return {
          session: {
            id: "session",
            version: 2,
            status: pending ? "pending" : "collecting",
            run_id: null,
          },
          run: null,
          sources: fixture.sources,
          error: null,
        };
      if (path.endsWith("/workspace/extractions"))
        return {
          preparation: {
            id: "prep",
            status: "running",
            created_at: new Date().toISOString(),
          },
          expectedWorkflows: ["ke24", "monthly_recharge"],
          executions: [],
        };
      return fixture.request(path, options);
    },
  );
  await render();
  await settle();
  await act(async () => {
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [
        new File(["revenue"], "KE24.XLSX"),
        new File(["recharge"], "DL_Monthly_Recharge_summary_report.csv"),
      ],
      configurable: true,
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    transfers.get("ke24")!.progress(60);
    transfers.get("monthly_recharge")!.progress(25);
  });
  expect(container.querySelectorAll(".pp-file progress")).toHaveLength(2);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => {
    fixture.sources.files.push({
      id: "ke24-file",
      source_code: "ke24",
      original_name: "KE24.XLSX",
    });
    transfers.get("ke24")!.resolve({ id: "ke24-file" });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(150);
  });
  expect(container.querySelectorAll(".pp-file progress")).toHaveLength(1);
  expect(container.textContent).toContain("Upload complete");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => {
    pending = true;
    fixture.sources.files.push({
      id: "recharge-file",
      source_code: "monthly_recharge",
      original_name: "DL_Monthly_Recharge_summary_report.csv",
    });
    transfers.get("monthly_recharge")!.resolve({ id: "recharge-file" });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(150);
  });
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain("Extracting your reports");
  expect(dialog.querySelector("progress")).toBeNull();
  expect(dialog.textContent).not.toContain("Uploading your files");
  expect(container.hasAttribute("inert")).toBe(true);
  expect(
    api.apiRequest.mock.calls.some(([, options]) => options?.method === "POST"),
  ).toBe(false);
});
it("loads allocation summaries first and only requests detail rows when the breakdown opens", async () => {
  fixture = createPrepaidFixture();
  api.apiRequest.mockImplementation(fixture.request);
  await render("/prepaid/allocation/eg/mt");
  await settle();
  expect(fixture.calls.some((c) => c.path.includes("allocation-summary"))).toBe(
    true,
  );
  expect(fixture.calls.some((c) => /\/allocations\?/.test(c.path))).toBe(false);
  await act(async () => find("View breakdown").click());
  await settle();
  expect(fixture.calls.some((c) => /\/allocations\?/.test(c.path))).toBe(true);
});
it("does not show empty history while its request is loading", async () => {
  let resolve!: (value: unknown) => void;
  const request = fixture.request;
  api.apiRequest.mockImplementation((path: string, options?: RequestInit) =>
    path.includes("/report-history")
      ? new Promise((r) => {
          resolve = r;
        })
      : request(path, options),
  );
  await render();
  await settle();
  await act(async () => find("History").click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Loading saved reports",
  );
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain(
    "No frozen",
  );
  await act(async () => resolve({ rows: [], hasMore: false }));
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain(
    "Loading saved reports",
  );
});


it("uses the workspace batch snapshot on entry and stops polling when review is ready", async () => {
  let status: "running" | "review" = "running";
  let importStage = "extracting";
  api.apiRequest.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path.endsWith("/workspace")) {
      return {
        session: null, run: null, sources: fixture.sources, error: null,
        awsBatchEnabled: true, awsBatchActive: true,
        awsBatchReviewReady: status === "review",
        awsBatch: {
          id: "batch", phase: "import", status, canReview: status === "review",
          executions: { import: { status: "RUNNING", importStage, startedAt: new Date(Date.now() - 30_000).toISOString() } },
          layouts: {}, error: null, deliveryEnabled: false,
        },
      };
    }
    return fixture.request(path, options);
  });
  const requests = (suffix: string) =>
    api.apiRequest.mock.calls.filter(([path]) => path.endsWith(suffix)).length;
  await render();
  await settle();
  expect(document.querySelector('[aria-label="Prepaid processing progress"]')).not.toBeNull();
  expect(requests("/workspace")).toBe(1);
  expect(requests("/aws-batch")).toBe(0);
  expect(document.body.textContent).toContain("Extracting your reports");
  expect(document.body.textContent).not.toContain("Extraction is complete");

  importStage = "refreshing-reference";
  await act(async () => find("Check status").click());
  await settle();
  expect(document.body.textContent).toContain("Refreshing SAP reference data");

  importStage = "importing-layouts";
  await act(async () => vi.advanceTimersByTimeAsync(4_000));
  expect(document.body.textContent).toContain("Preparing your review tables");

  status = "review";
  await act(async () => vi.advanceTimersByTimeAsync(4_000));
  expect(document.querySelector('[aria-label="Prepaid processing progress"]')).toBeNull();
  expect(container.textContent).toContain("EG Layout Review");
  expect(container.querySelector(".pp-step[aria-current=step]")?.textContent).toBe("2");

  await act(async () => container.querySelector<HTMLButtonElement>(".pp-step")?.click());
  expect(container.querySelector(".pp-step[aria-current=step]")?.textContent).toBe("1");
  await act(async () => vi.advanceTimersByTimeAsync(12_000));
  expect(requests("/workspace")).toBe(4);
  expect(requests("/aws-batch")).toBe(0);
});
