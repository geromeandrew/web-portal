import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PrepaidRoute from "../src/routes/PrepaidRoute";
import { createPrepaidFixture } from "./fixtures/prepaidFixture";
import { ApiClientError } from "../src/lib/apiClient";
import * as prepaidApi from "../src/lib/prepaidApi";
const api = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  downloadApiFile: vi.fn(),
}));
vi.mock("../src/lib/apiClient", () => ({
  ...api,
  ApiClientError: class extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
describe("Prepaid refined workspace", () => {
  let root: Root,
    container: HTMLDivElement,
    fixture: ReturnType<typeof createPrepaidFixture>;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    fixture = createPrepaidFixture();
    api.apiRequest.mockImplementation(fixture.request);
    api.downloadApiFile.mockResolvedValue(undefined);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });
  const flush = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  };
  const render = async (path = "/prepaid/eg-layout") =>
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
      await flush();
    });
  const button = (text: string) =>
    Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === text,
    )!;
  const click = async (text: string) =>
    act(async () => {
      button(text).click();
      await flush();
    });
  const fill = async (
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ) =>
    act(async () => {
      const proto =
        element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(
        element,
        value,
      );
      element.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
  it("has exactly two steps, restores real layouts, and never creates a run on view", async () => {
    await render();
    expect(container.querySelectorAll(".pp-stepper li")).toHaveLength(2);
    expect(container.textContent).toContain("Edit & validate");
    expect(container.textContent).not.toContain("Accounting period");
    expect(container.textContent).not.toContain("Create run");
    expect(container.textContent).not.toContain("Process sources");
    expect(container.querySelectorAll(".pp-layout-table th")).toHaveLength(9);
    expect(
      fixture.calls.some(
        (c) => c.path === "/runs" && c.options?.method === "POST",
      ),
    ).toBe(false);
  });
  it("renders an empty upload panel without fabricated activity or waiting rows", async () => {
    fixture = createPrepaidFixture("upload");
    api.apiRequest.mockImplementation(fixture.request);
    await render("/prepaid/file-upload");
    expect(container.textContent).toContain("Uploaded files will appear here");
    expect(container.textContent).toContain("KE24.XLSX");
    expect(container.textContent).not.toContain("UPLOAD ACTIVITY");
    expect(container.querySelectorAll(".pp-file")).toHaveLength(0);
  });
  it("starts partial AWS processing only after clicking Step 2", async () => {
    fixture = createPrepaidFixture("upload");
    let started = false;
    api.apiRequest.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path.endsWith("/workspace/prepare")) {
        started = true;
        expect(JSON.parse(String(options?.body))).toEqual({});
        return {};
      }
      if (path.endsWith("/workspace")) {
        return {
          session: null, run: null, error: null,
          awsBatchEnabled: true, awsBatchActive: started, billCycles: ["01", "21"],
          awsBatch: started ? {
            id: "batch", phase: "import", status: "queued",
            executions: {}, layouts: {}, deliveryEnabled: true,
          } : null,
          sources: {
            ...fixture.sources,
            files: [{ id: "upload", source_code: "monthly_recharge", original_name: "recharge.csv" }],
          },
        };
      }
      return fixture.request(path, options);
    });
    await render("/prepaid/file-upload");
    expect(container.textContent).not.toContain("Start processing");
    expect(started).toBe(false);
    const step2 = container.querySelector<HTMLButtonElement>('[aria-label="Step 2: Edit & validate"]')!;
    expect(step2.disabled).toBe(false);
    await click("2");
    expect(started).toBe(true);
    expect(container.querySelector(".pp-step[aria-current=step]")?.textContent).toBe("2");
    expect(step2.disabled).toBe(true);
  });
  it("shows nonblocking reference notes in the existing panel when validation passes", async () => {
    fixture.layouts.eg.validation = {
      valid: true,
      findings: [
        {
          code: "AVERAGE_RATE_ZERO",
          severity: "warning",
          policy: "legacy_all_matches",
        },
      ],
    };
    await render();
    expect(container.textContent).toContain("Check before freezing");
    expect(container.textContent).toContain("calculated quantity is zero");
    expect(container.textContent).not.toContain("Validation needs attention");
    expect(button("Freeze").disabled).toBe(false);
    expect(container.textContent).not.toContain("AVERAGE_RATE_ZERO");
  });
  it("opens the correct region's allocation and exposes the rates and quantities for review", async () => {
    fixture.layouts.sg.validation = {
      valid: true,
      findings: [
        {
          code: "AVERAGE_RATE_ZERO",
          severity: "warning",
          policy: "legacy_all_matches",
        },
      ],
    };
    await render("/prepaid/sg-layout");
    await click("Review allocation");
    expect(container.textContent).toContain("SG MT Allocation");
    await click("View breakdown");
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("AVERAGE RATE");
    expect(dialog.textContent).toContain("SUB-PRODUCT");
    expect(dialog.textContent).toContain("QUANTITY");
    expect(
      fixture.calls.some((call) =>
        call.path.includes("/layouts/sg/allocations?"),
      ),
    ).toBe(true);
    expect(
      fixture.calls.some(
        (call) => call.options?.method && call.options.method !== "GET",
      ),
    ).toBe(false);
  });
  it("does not report an acknowledged upload as failed when its workspace refresh fails", async () => {
    fixture = createPrepaidFixture("upload");
    api.apiRequest.mockImplementation(fixture.request);
    await render("/prepaid/file-upload");
    vi.spyOn(prepaidApi, "uploadSource").mockResolvedValue({
      id: "saved-file",
    });
    api.apiRequest.mockRejectedValue(new Error("Temporary refresh failure"));
    await act(async () => {
      const input =
        container.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File(["PK test"], "KE24.XLSX")],
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(container.textContent).toContain("File uploaded successfully");
    expect(container.textContent).not.toContain("Upload connection failed");
    expect(container.textContent).not.toContain("Retry");
    expect(container.textContent).toContain("KE24.XLSX");
  });
  it("allows collection before setup, shows billing filename families and polls without adding UI controls", async () => {
    fixture = createPrepaidFixture("upload");
    let configured = false;
    const message =
      "You can upload source files now. Files are saved while processing setup is completed.";
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        const data = (await fixture.request(path, options)) as any;
        if (path.endsWith("/workspace"))
          return {
            ...data,
            session: {
              id: "collection-session",
              version: 1,
              status: configured ? "pending" : "collecting",
              run_id: null,
            },
            preparation: { configured, message: configured ? null : message },
            sources: {
              ...data.sources,
              valid: false,
              collectionOnly: !configured,
              guidelines: [
                "KE24.XLSX",
                "308. Billed Adjustments Monthly Summary Report_G_BC{cycle}.XLSX",
                "318. Billed Charges Summary Report_G_BC{cycle}.XLSX",
              ],
            },
          };
        return data;
      },
    );
    const interval = vi.spyOn(globalThis, "setTimeout");
    try {
      await render("/prepaid/file-upload");
      expect(
        container.querySelector<HTMLButtonElement>(".pp-dropzone")?.disabled,
      ).toBe(false);
      expect(container.textContent).toContain(message);
      expect(container.querySelector(".pp-notice")?.getAttribute("role")).toBe(
        "status",
      );
      expect(
        container.querySelector(".pp-notice")?.getAttribute("role"),
      ).not.toBe("alert");
      expect(container.textContent).toContain("BC{cycle}.XLSX");
      expect(container.querySelectorAll(".pp-stepper li")).toHaveLength(2);
      expect(
        container.querySelectorAll<HTMLButtonElement>(".pp-step")[1].disabled,
      ).toBe(true);
      expect(container.textContent).not.toContain("Create run");
      expect(container.textContent).not.toContain("Accounting period");
      const callback = interval.mock.calls.find(
        ([, ms]) => ms === 4000,
      )?.[0] as (() => void) | undefined;
      expect(callback).toBeDefined();
      configured = true;
      await act(async () => {
        callback!();
        await flush();
      });
      expect(
        container.querySelector<HTMLButtonElement>(".pp-dropzone")?.disabled,
      ).toBe(true);
      expect(container.textContent).not.toContain(message);
    } finally {
      interval.mockRestore();
    }
  });
  it("only edits backend-authorized gross cells and saves decimal strings directly with version", async () => {
    await render();
    await click("Edit");
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement>(".pp-layout-table input"),
    );
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((i) => !i.disabled)).toBe(true);
    expect(
      inputs
        .filter((i) => !i.disabled)
        .every((i) => /gross/.test(i.getAttribute("aria-label") ?? "")),
    ).toBe(true);
    await fill(
      inputs.find((i) => !i.disabled)!,
      "123.45",
    );
    expect(button("Freeze").disabled).toBe(true);
    await click("Save");
    const call = fixture.calls.find((c) => c.options?.method === "PATCH")!;
    const body = JSON.parse(String(call.options?.body));
    expect(body.version).toBe(1);
    expect(body.reason).toBeUndefined();
    expect(document.querySelector("textarea")).toBeNull();
    expect(body.changes[0].value).toBe("123.45");
    expect(container.textContent).toContain("Edits saved");
    expect(fixture.calls.some((c) => c.path.endsWith("/validate"))).toBe(false);
  });
  it.each(["eg", "sg"] as const)(
    "shows saving feedback for %s until the backend confirms the updated layout",
    async (region) => {
      let finishSave!: () => Promise<void>;
      api.apiRequest.mockImplementation(
        (path: string, options?: RequestInit) => {
          if (options?.method === "PATCH")
            return new Promise((resolve) => {
              finishSave = async () =>
                resolve(await fixture.request(path, options));
            });
          return fixture.request(path, options);
        },
      );
      await render(`/prepaid/${region}-layout`);
      await click("Edit");
      const cell = Array.from(
        container.querySelectorAll<HTMLInputElement>(".pp-layout-table input"),
      ).find((input) => !input.disabled)!;
      await fill(cell, "321.09");
      const readsBeforeSave = fixture.calls.length;
      await click("Save");

      const savingButton = button("Saving...");
      expect(savingButton.disabled).toBe(true);
      expect(savingButton.getAttribute("aria-busy")).toBe("true");
      expect(
        container.querySelector("#prepaid-save-status")?.getAttribute("role"),
      ).toBe("status");
      expect(container.textContent).toContain("Saving changes...");
      expect(
        container.querySelector(".pp-review-content > [role='status']")?.id,
      ).toBe("prepaid-save-status");
      expect(
        container
          .querySelector(".pp-review-content .pp-table-scroll")
          ?.getAttribute("aria-busy"),
      ).toBe("true");
      expect(container.textContent).not.toContain("Edits saved");
      expect(cell.value).toBe("321.09");
      expect(
        Array.from(
          container.querySelectorAll<HTMLInputElement>(
            ".pp-layout-table input",
          ),
        ).every((input) => input.disabled),
      ).toBe(true);
      expect(button("Freeze").disabled).toBe(true);
      expect(button("SG Layout").disabled).toBe(true);
      expect(button("EG Layout").disabled).toBe(true);
      expect(button("History").disabled).toBe(true);
      expect(button("Reset").disabled).toBe(true);
      expect(
        container.querySelector<HTMLSelectElement>("#allocation-tab")?.disabled,
      ).toBe(true);
      expect(
        container.querySelector<HTMLSelectElement>("#jv-tab")?.disabled,
      ).toBe(true);
      expect(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>(".pp-step"),
        ).every((step) => step.disabled),
      ).toBe(true);
      await act(async () => savingButton.click());
      expect(
        api.apiRequest.mock.calls.filter((call) => call[1]?.method === "PATCH"),
      ).toHaveLength(1);

      await act(async () => {
        await finishSave();
        await flush();
      });
      expect(container.querySelector("#prepaid-save-status")).toBeNull();
      expect(container.textContent).toContain("Edits saved");
      const savedMessage = container.querySelector(
        ".pp-review-content > [role='status']",
      );
      expect(savedMessage?.textContent).toBe("Edits saved");
      expect(container.querySelector(".pp-workspace > .pp-toast")).toBeNull();
      expect(
        container
          .querySelector(".pp-review-content .pp-table-scroll")
          ?.getAttribute("aria-busy"),
      ).toBe("false");
      expect(container.textContent).toContain("321.09");
      expect(container.querySelectorAll(".pp-layout-table input")).toHaveLength(
        0,
      );
      expect(button("Edit").disabled).toBe(false);
      // Only the PATCH was needed: its response already contains the new layout.
      expect(fixture.calls).toHaveLength(readsBeforeSave + 1);
      expect(fixture.layouts[region].version).toBe(2);
    },
  );
  it("retains edits and restores Save after a failed request, then saves on retry", async () => {
    let fail = true;
    api.apiRequest.mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === "PATCH" && fail)
        return Promise.reject(
          new Error("Could not save your changes. Please try again."),
        );
      return fixture.request(path, options);
    });
    await render();
    await click("Edit");
    const cell = Array.from(
      container.querySelectorAll<HTMLInputElement>(".pp-layout-table input"),
    ).find((input) => !input.disabled)!;
    await fill(cell, "321.09");
    await click("Save");
    expect(container.querySelector("#prepaid-save-status")).toBeNull();
    expect(container.textContent).toContain("Could not save your changes");
    expect(container.textContent).not.toContain("Edits saved");
    expect(cell.value).toBe("321.09");
    expect(cell.disabled).toBe(false);
    expect(button("Save").disabled).toBe(false);
    expect(button("Freeze").disabled).toBe(true);

    fail = false;
    await click("Save");
    expect(container.textContent).toContain("Edits saved");
    expect(container.textContent).not.toContain("Could not save your changes");
    expect(
      api.apiRequest.mock.calls.filter((call) => call[1]?.method === "PATCH"),
    ).toHaveLength(2);
    expect(fixture.layouts.eg.version).toBe(2);
  });
  it("keeps derived GP remainder read-only when the backend selects legacy source conservation", async () => {
    const request = fixture.request;
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        const result = (await request(path, options)) as any;
        if (path.endsWith("/layouts/eg"))
          for (const row of result.rows)
            if (row.editable)
              row.editable_fields = ["hy_mt_gross", "gp_bb_gross"];
        return result;
      },
    );
    await render();
    await click("Edit");
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement>(".pp-layout-table input"),
    );
    expect(
      inputs
        .filter((i) => !i.disabled)
        .some((i) => i.getAttribute("aria-label")?.includes("hy_mt_gross")),
    ).toBe(true);
    expect(
      inputs
        .some((i) => i.getAttribute("aria-label")?.includes("gp_mt_gross")),
    ).toBe(false);
    expect(container.querySelectorAll(".pp-stepper li")).toHaveLength(2);
  });
  it("freezes using current version, shows manual staging and retains Edit", async () => {
    await render();
    await click("Freeze");
    expect(container.textContent).toContain("waiting for manual SAP execution");
    expect(container.textContent).toContain(
      "Your EG reclassifications have been saved and locked.",
    );
    expect(container.textContent).not.toContain("Your SG/EG");
    expect(container.textContent).not.toContain("Data last saved and locked:");
    expect(container.querySelector(".pp-panel-heading .pp-locked")?.textContent).toBe("Layout frozen");
    expect(container.querySelector(".pp-freeze-tooltip")?.textContent).toBe("This layout is already locked.");
    expect(button("Edit").disabled).toBe(false);
    expect(button("Freeze").disabled).toBe(true);
    await click("Edit");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(
      container.querySelectorAll(".pp-layout-table input").length,
    ).toBeGreaterThan(0);
  });
  it("refreshes a stale save conflict without retrying or overwriting server data", async () => {
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (options?.method === "PATCH") {
          fixture.layouts.eg.version = 2;
          throw new ApiClientError(
            409,
            "PREPAID_STALE_VERSION",
            "Stale layout",
          );
        }
        return fixture.request(path, options);
      },
    );
    await render();
    await click("Edit");
    const cell = Array.from(
      container.querySelectorAll<HTMLInputElement>(".pp-layout-table input"),
    ).find((i) => !i.disabled)!;
    await fill(cell, "999.99");
    await click("Save");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelectorAll(".pp-layout-table input")).toHaveLength(
      0,
    );
    expect(
      api.apiRequest.mock.calls.filter((c) => c[1]?.method === "PATCH"),
    ).toHaveLength(1);
    expect(
      fixture.layouts.eg.rows.some((r) => r.gp_mt_gross === "999.99"),
    ).toBe(false);
  });
  it("resets via one versioned workspace command, not global source deletion", async () => {
    await render();
    await click("Reset");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await click("Yes, reset");
    expect(
      fixture.calls.find((c) => c.path === "/workspace/reset")?.options?.body,
    ).toBe(JSON.stringify({ runId: fixture.run.id, eg: 1, sg: 1 }));
    expect(document.body.textContent).toContain("Workspace reset");
    expect(fixture.calls.some((c) => c.options?.method === "DELETE")).toBe(
      false,
    );
    await click("Okay, got it");
    expect(container.textContent).toContain("Uploaded files will appear here");
  });
  function uploadedSession(
    status = "collecting",
    resetContext: unknown = null,
  ) {
    fixture = createPrepaidFixture("upload");
    fixture.sources.files = [
      { id: "saved-file", source_code: "ke24", original_name: "KE24.XLSX" },
    ];
    const session = {
      id: "upload-session",
      version: 17,
      status,
      run_id: resetContext ? "fixture-run" : null,
    };
    const state = () => ({
      session,
      run: null,
      sources: fixture.sources,
      error: null,
      resetContext,
    });
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (path.endsWith("/workspace")) return structuredClone(state());
        if (options?.method === "DELETE") {
          fixture.sources.files = [];
          return structuredClone(state());
        }
        return fixture.request(path, options);
      },
    );
    return { session, state };
  }
  it("resets a reviewed import through the workspace without a separate close action", async () => {
    const { state } = uploadedSession("ready");
    const request = api.apiRequest.getMockImplementation()!;
    const batch = { status: "review", phase: "import", executions: {}, layouts: {}, error: null };
    api.apiRequest.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path.endsWith("/workspace"))
        return { ...state(), awsBatchEnabled: true, awsBatchActive: true, awsBatchResetAllowed: true };
      if (path.endsWith("/aws-batch")) return { batch };
      return request(path, options);
    });
    await render("/prepaid/file-upload");
    expect(container.textContent).not.toContain("Ready for review");
    expect(container.textContent).not.toContain("AWS batch");
    expect(button("Reset").disabled).toBe(false);
    await click("Reset");
    await click("Yes, reset");
    expect(api.apiRequest).toHaveBeenCalledWith(
      "/workflows/prepaid/workspace/reset",
      expect.objectContaining({ body: JSON.stringify({sessionId: "upload-session", sessionVersion: 17}) }),
    );
    expect(api.apiRequest.mock.calls.some(([path]) => path.endsWith("/aws-batch/action"))).toBe(false);
  });
  it("opens Step 2, shows save feedback, and freezes the selected side", async () => {
    const { state } = uploadedSession("ready");
    let completeSave!: () => void;
    const saveResponse = new Promise<void>((resolve) => { completeSave = resolve; });
    const batch = {
      id: "test-batch",
      canReview: true,
      status: "review",
      phase: "import",
      deliveryEnabled: true,
      executions: { import: { status: "SUCCEEDED" } },
      layouts: { eg: [{ label: "Variance", gross: "0.00" }], sg: [{ label: "Variance", gross: "0.00" }] },
      error: null,
    };
    const request = api.apiRequest.getMockImplementation()!;
    api.apiRequest.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path.endsWith("/workspace"))
        return { ...state(), awsBatchEnabled: true, awsBatchActive: true, awsBatchReviewReady: true };
      if (path.endsWith("/aws-batch")) return { batch };
      if (path.includes("/aws-batch/review/")) {
        if (options?.method === "PATCH") await saveResponse;
        return {
          rows: [
            { layout_number: 8, label: "CALLCARD", gp_mt_gross: "100.00", hy_mt_gross: "0.00", gp_bb_gross: null, total_gross: "100.00", editable_fields: ["gp_mt_gross", "hy_mt_gross", "gp_bb_gross"] },
            { layout_number: 12, label: "AMAXCE", hy_mt_gross: "10.00", editable_fields: [] },
            { layout_number: 13, label: "Adjustments", hy_mt_gross: options?.method === "PATCH" ? "12.34" : "10.00", editable_fields: ["hy_mt_gross"] },
          ],
          hasMore: false, pendingJournal: false, canEdit: true, layoutVersion: "a".repeat(64),
        };
      }
      if (path.endsWith("/aws-batch/action")) return { queued: true };
      return request(path, options);
    });

    await render("/prepaid/file-upload");
    expect(button("2").disabled).toBe(false);
    expect(container.textContent).toContain("EG Layout Review");
    expect(container.textContent).toContain("AMAXCE");
    expect(container.querySelector("#allocation-tab")).not.toBeNull();
    expect(container.querySelector("#jv-tab")).not.toBeNull();
    await click("Edit");
    expect(button("Freeze").disabled).toBe(true);
    expect(container.textContent).toContain("Save your changes before freezing this layout.");
    expect(container.querySelector('input[aria-label="CALLCARD hy_mt_gross"]')).not.toBeNull();
    expect(container.querySelector('input[aria-label="CALLCARD gp_bb_gross"]')).not.toBeNull();
    expect(container.querySelector('input[aria-label="CALLCARD gp_mt_gross"]')).not.toBeNull();
    expect(container.querySelector('input[aria-label="AMAXCE hy_mt_gross"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[aria-label="CALLCARD gp_mt_gross"]')?.disabled).toBe(false);
    expect(container.querySelector('input[aria-label="CALLCARD total_gross"]')).toBeNull();
    const amount = container.querySelector<HTMLInputElement>('input[aria-label="Adjustments hy_mt_gross"]')!;
    await fill(amount, "12.34");
    await click("Save");
    expect(button("Saving...").disabled).toBe(true);
    expect(button("Freeze").disabled).toBe(true);
    expect(button("Reset").disabled).toBe(true);
    expect(container.textContent).toContain("Saving changes...");
    await act(async () => { completeSave(); await flush(); });
    expect(container.textContent).toContain("Edits saved");
    expect(container.textContent).toContain("12.34");
    expect(api.apiRequest).toHaveBeenCalledWith(
      "/workflows/prepaid/aws-batch/review/eg/layout",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          batchId: "test-batch",
          layoutVersion: "a".repeat(64),
          changes: [{ layoutNumber: 13, field: "hy_mt_gross", value: "12.34" }],
        }),
      }),
    );
    await click("SG Layout");
    expect(container.textContent).toContain("SG Layout Review");

    await click("Freeze");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Freeze the SG layout?");
    await click("Yes, freeze");
    expect(api.apiRequest).toHaveBeenCalledWith(
      "/workflows/prepaid/aws-batch/action",
      expect.objectContaining({ body: JSON.stringify({ action: "sg" }) }),
    );
  });
  it("keeps batch status above the uploads and opens the allocation breakdown", async () => {
    const { state } = uploadedSession("ready");
    const request = api.apiRequest.getMockImplementation()!;
    const batch = {
      id: "test-batch", canReview: true, status: "review", phase: "import",
      executions: { import: { status: "SUCCEEDED" } }, layouts: {}, error: null,
    };
    api.apiRequest.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path.endsWith("/workspace"))
        return { ...state(), awsBatchEnabled: true, awsBatchActive: true, awsBatchReviewReady: true };
      if (path.endsWith("/aws-batch")) return { batch };
      if (path.includes("/aws-batch/review/") && path.includes("/layout?")) return {
        rows: [], hasMore: false, pendingJournal: false,
      };
      if (path.includes("/allocation-summary?")) return {
        rows: [{ type: "GP EG MT", gross: "112.00" }], hasMore: false, pendingJournal: false,
      };
      if (path.includes("/allocation?")) return {
        rows: [{ profit_center: "00001234" }], hasMore: !path.includes("offset=100"), pendingJournal: false,
      };
      return request(path, options);
    });

    await render("/prepaid/file-upload");
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".pp-step")!.click();
      await flush();
    });
    expect(container.querySelector(".pp-batch-status")).toBeNull();
    await click("2");
    await act(async () => {
      const allocation = container.querySelector<HTMLSelectElement>("#allocation-tab")!;
      allocation.value = "eg-mt";
      allocation.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    });
    expect(container.textContent).toContain("GP EG MT");
    await click("View breakdown");
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("EG MT Allocation breakdown");
    expect(dialog.textContent).toContain("00001234");
    await click("Next");
    expect(api.apiRequest.mock.calls.some(([path]) => path.includes("/eg/allocation?") && path.includes("offset=100"))).toBe(true);
  });
  const removeButton = () =>
    container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove KE24.XLSX"]',
    )!;
  const openRemoval = async () =>
    act(async () => {
      removeButton().click();
      await flush();
    });
  it("confirms removal without sending DELETE on cancel, then announces confirmed removal", async () => {
    uploadedSession();
    await render("/prepaid/file-upload");
    await openRemoval();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "original stored copy",
    );
    expect(
      api.apiRequest.mock.calls.some(([, o]) => o?.method === "DELETE"),
    ).toBe(false);
    await click("No, keep file");
    expect(container.querySelectorAll(".pp-file")).toHaveLength(1);
    await openRemoval();
    await click("Yes, remove");
    expect(api.apiRequest).toHaveBeenCalledWith(
      "/workflows/prepaid/workspace/sources/ke24",
      { method: "DELETE" },
    );
    expect(container.querySelectorAll(".pp-file")).toHaveLength(0);
    expect(container.textContent).toContain(
      "KE24.XLSX removed from the workspace.",
    );
  });
  it("shows Removing, prevents duplicate requests and keeps the dialog open until acknowledged", async () => {
    uploadedSession();
    const request = api.apiRequest.getMockImplementation()!;
    let complete!: () => void;
    const blocked = new Promise<void>((resolve) => {
      complete = resolve;
    });
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (options?.method === "DELETE") await blocked;
        return request(path, options);
      },
    );
    await render("/prepaid/file-upload");
    await openRemoval();
    await click("Yes, remove");
    expect(
      container.querySelector('.pp-file[aria-busy="true"]'),
    ).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Removing…",
    );
    expect(button("No, keep file").disabled).toBe(true);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flush();
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
      complete();
      await flush();
    });
    expect(
      api.apiRequest.mock.calls.filter(([, o]) => o?.method === "DELETE"),
    ).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("keeps files and displays the error when removal is rejected", async () => {
    uploadedSession();
    const request = api.apiRequest.getMockImplementation()!;
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (options?.method === "DELETE")
          throw new Error("Removal could not be completed. Try again.");
        return request(path, options);
      },
    );
    await render("/prepaid/file-upload");
    await openRemoval();
    await click("Yes, remove");
    expect(container.querySelectorAll(".pp-file")).toHaveLength(1);
    expect(
      document.querySelector('[role="dialog"] [role="alert"]')?.textContent,
    ).toContain("Removal could not be completed");
    expect(button("Yes, remove").disabled).toBe(false);
    expect(container.querySelector(".pp-toast")).toBeNull();
  });
  it("does not report a completed removal as failed when only the refresh fails", async () => {
    uploadedSession();
    const request = api.apiRequest.getMockImplementation()!;
    let removed = false;
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (removed && path.endsWith("/workspace"))
          throw new Error("Refresh unavailable");
        const result = await request(path, options);
        if (options?.method === "DELETE") removed = true;
        return result;
      },
    );
    await render("/prepaid/file-upload");
    await openRemoval();
    await click("Yes, remove");
    expect(container.querySelectorAll(".pp-file")).toHaveLength(0);
    expect(container.textContent).toContain(
      "File removed successfully, but the workspace could not refresh.",
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("explains pending extraction instead of silently disabling Reset and removal", async () => {
    uploadedSession("pending");
    await render("/prepaid/file-upload");
    expect(removeButton().disabled).toBe(true);
    expect(button("Reset").disabled).toBe(true);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Extracting your reports",
    );
    expect(
      document.querySelector(
        '[role="dialog"] button[aria-label="Close dialog"]',
      ),
    ).toBeNull();
    expect(button("Check status")).toBeUndefined();
    expect(
      api.apiRequest.mock.calls.some(
        ([, o]) => o?.method === "DELETE" || o?.method === "POST",
      ),
    ).toBe(false);
  });
  it("removes historical run-based files through the run endpoint, not a nonexistent session", async () => {
    await render();
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".pp-step")!.click();
      await flush();
    });
    await openRemoval();
    await click("Yes, remove");
    expect(api.apiRequest).toHaveBeenCalledWith(
      "/workflows/prepaid/runs/fixture-run/sources/ke24",
      { method: "DELETE" },
    );
    expect(
      api.apiRequest.mock.calls.some(
        ([path, o]) =>
          path.includes("/workspace/sources/") && o?.method === "DELETE",
      ),
    ).toBe(false);
  });
  it("retains the versioned Reset context when source changes hide the review run", async () => {
    uploadedSession("collecting", { runId: "fixture-run", eg: 7, sg: 9 });
    await render("/prepaid/file-upload");
    await click("Reset");
    await click("Yes, reset");
    const call = api.apiRequest.mock.calls.find(([path]) =>
      path.endsWith("/workspace/reset"),
    )!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      runId: "fixture-run",
      eg: 7,
      sg: 9,
      sessionId: "upload-session",
      sessionVersion: 17,
    });
    expect(document.body.textContent).toContain("Workspace reset");
  });
  it("refreshes a stale session conflict and preserves its message for retry", async () => {
    uploadedSession();
    const request = api.apiRequest.getMockImplementation()!;
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (path.endsWith("/workspace/reset"))
          throw new ApiClientError(
            409,
            "PREPAID_SESSION_CHANGED",
            "Refresh the workspace before resetting.",
          );
        return request(path, options);
      },
    );
    await render("/prepaid/file-upload");
    await click("Reset");
    await click("Yes, reset");
    expect(
      document.querySelector('[role="dialog"] [role="alert"]')?.textContent,
    ).toContain("Refresh the workspace before resetting.");
    expect(
      api.apiRequest.mock.calls.filter(([p]) => p.endsWith("/workspace")),
    ).toHaveLength(2);
    expect(button("Yes, reset").disabled).toBe(false);
  });
  it("keeps Reset success visible when its subsequent refresh fails", async () => {
    uploadedSession();
    const request = api.apiRequest.getMockImplementation()!;
    let reset = false;
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (reset && path.endsWith("/workspace"))
          throw new Error("Refresh unavailable");
        const result = await request(path, options);
        if (path.endsWith("/workspace/reset")) reset = true;
        return result;
      },
    );
    await render("/prepaid/file-upload");
    await click("Reset");
    await click("Yes, reset");
    expect(document.body.textContent).toContain("Workspace reset");
    expect(container.querySelectorAll(".pp-file")).toHaveLength(0);
    expect(container.textContent).toContain(
      "Workspace reset successfully, but its latest state could not be loaded.",
    );
  });
  it("uses refreshed visible layout versions rather than an older Reset context", async () => {
    const request = fixture.request;
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        const result = (await request(path, options)) as any;
        if (path.endsWith("/workspace"))
          return {
            ...result,
            resetContext: { runId: "fixture-run", eg: 0, sg: 0 },
          };
        return result;
      },
    );
    await render();
    await click("Reset");
    await click("Yes, reset");
    const call = api.apiRequest.mock.calls.find(([path]) =>
      path.endsWith("/workspace/reset"),
    )!;
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({
      runId: "fixture-run",
      eg: 1,
      sg: 1,
    });
  });
  it("loads snapshot history and downloads an owned snapshot ZIP", async () => {
    await render();
    await click("History");
    expect(document.body.textContent).toContain("DATE OF UPLOAD");
    await fill(
      document.querySelector<HTMLInputElement>(".pp-filter input")!,
      "2026-09-04",
    );
    expect(fixture.calls.some((c) => c.path.includes("date=2026-09-04"))).toBe(
      true,
    );
    await click("Download reports");
    expect(api.downloadApiFile).toHaveBeenCalledWith(
      expect.stringContaining("/reports/snapshot0.zip"),
      expect.stringContaining("reports.zip"),
    );
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flush();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("downloads both regional XLSX journals separately from batch history", async () => {
    api.apiRequest.mockImplementation(async (path, options) => {
      if (path.includes("/report-history")) return {
        rows: [{
          snapshot_id: "sandbox-batch",
          uploaded_at: "2026-11-19T00:00:00Z",
          uploaded_by: "Sandbox user",
          journals: [
            { region: "eg", filename: "txPrepaid_JV_EGSel.xlsx" },
            { region: "sg", filename: "txPrepaid_JV_SGSel.xlsx" },
          ],
        }],
        hasMore: false,
      };
      return fixture.request(path, options);
    });
    await render();
    await click("History");
    expect(document.querySelectorAll(".pp-history-actions button")).toHaveLength(2);
    let finishDownload!: () => void;
    api.downloadApiFile.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishDownload = resolve;
    }));
    await click("Download EG JV");
    expect(button("Downloading EG JV...").getAttribute("aria-busy")).toBe("true");
    expect(button("Download SG JV").getAttribute("aria-busy")).toBe("false");
    expect(api.downloadApiFile).toHaveBeenCalledWith(
      "/workflows/prepaid/aws-batch/sandbox-batch/journal/eg",
      "txPrepaid_JV_EGSel.xlsx",
    );
    await act(async () => { finishDownload(); await flush(); });
    await click("Download SG JV");
    expect(api.downloadApiFile).toHaveBeenCalledWith(
      "/workflows/prepaid/aws-batch/sandbox-batch/journal/sg",
      "txPrepaid_JV_SGSel.xlsx",
    );
  });
  it.each(["eg/mt", "eg/bb", "sg/mt", "sg/bb"])(
    "uses the seven-column summary and paginated breakdown for %s",
    async (view) => {
      await render("/prepaid/allocation/" + view);
      expect(container.querySelectorAll(".pp-review th")).toHaveLength(7);
      expect(container.textContent).toContain("Posting Key 40");
      await click("View breakdown");
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
        "DENOMINATOR",
      );
      expect(
        fixture.calls.some((c) =>
          c.path.includes("allocation-summary?variant=" + view.split("/")[1]),
        ),
      ).toBe(true);
    },
  );
  it("shows the JV loading state instead of falsely reporting an empty revision", async () => {
    let finish!: () => void;
    api.apiRequest.mockImplementation((path: string, options?: RequestInit) => {
      if (path.includes("/jv?"))
        return new Promise((resolve) => {
          finish = () => {
            void fixture.request(path, options).then(resolve);
          };
        });
      return fixture.request(path, options);
    });
    await render("/prepaid/jv/eg/mt");
    expect(container.textContent).toContain("Loading EG JV...");
    expect(container.textContent).not.toContain(
      "No data available for this revision.",
    );
    expect(
      container.querySelector('.pp-review [aria-busy="true"]'),
    ).not.toBeNull();
    await act(async () => {
      finish();
      await flush();
    });
    expect(container.textContent).not.toContain("Loading EG JV...");
    expect(container.textContent).toContain("GLOB");
  });
  it("shows a JV request failure separately from an empty result", async () => {
    let fail!: (error: Error) => void;
    api.apiRequest.mockImplementation((path: string, options?: RequestInit) => {
      if (path.includes("/jv?"))
        return new Promise((_, reject) => {
          fail = reject;
        });
      return fixture.request(path, options);
    });
    await render("/prepaid/jv/eg/mt");
    await act(async () => {
      fail(Error("JV temporarily unavailable"));
      await flush();
    });
    expect(
      container.querySelector('.pp-review [role="alert"]')?.textContent,
    ).toContain("JV temporarily unavailable");
    expect(container.textContent).not.toContain(
      "No data available for this revision.",
    );
    expect(container.textContent).not.toContain("Loading EG JV...");
  });
  it("cancels a superseded JV request and ignores its late response", async () => {
    let finish!: () => void;
    let signal: AbortSignal | undefined;
    api.apiRequest.mockImplementation((path: string, options?: RequestInit) => {
      if (path.includes("/layouts/eg/jv?")) {
        signal = options?.signal ?? undefined;
        return new Promise((resolve) => {
          finish = () => {
            void fixture.request(path, options).then((value) =>
              resolve({
                ...(value as object),
                rows: [
                  {
                    posting_key: 40,
                    amount: "1",
                    quantity: "1",
                    fields: { marker: "STALE EG" },
                  },
                ],
              }),
            );
          };
        });
      }
      return fixture.request(path, options);
    });
    await render("/prepaid/jv/eg/mt");
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>("#jv-tab")!;
      select.value = "sg";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    });
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      finish();
      await flush();
    });
    expect(container.textContent).toContain("SG JV");
    expect(container.textContent).not.toContain("STALE EG");
  });
  it("reuses an unchanged JV page on a tab revisit and invalidates it after layout edits", async () => {
    const selectJV = async (region: string) =>
      act(async () => {
        const select = container.querySelector<HTMLSelectElement>("#jv-tab")!;
        select.value = region;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await flush();
      });
    const requests = () =>
      fixture.calls.filter((call) => call.path.includes("/layouts/eg/jv?"))
        .length;
    await render("/prepaid/jv/eg/mt");
    expect(requests()).toBe(1);
    await selectJV("sg");
    await selectJV("eg");
    expect(requests()).toBe(1);
    await click("EG Layout");
    await click("Edit");
    const input = Array.from(
      container.querySelectorAll<HTMLInputElement>(".pp-layout-table input"),
    ).find((item) => !item.disabled)!;
    await fill(input, "123.45");
    await click("Save");
    await selectJV("eg");
    expect(requests()).toBe(2);
  });
});
