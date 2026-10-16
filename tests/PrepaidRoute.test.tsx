import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PrepaidRoute from "../src/routes/PrepaidRoute";
import { createPrepaidFixture } from "./fixtures/prepaidFixture";
import { ApiClientError } from "../src/lib/apiClient";
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
  it("only edits backend-authorized gross cells and saves decimal strings directly with version", async () => {
    await render();
    await click("Edit");
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement>(".pp-layout-table input"),
    );
    expect(inputs.some((i) => i.disabled)).toBe(true);
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
        .filter((i) => i.getAttribute("aria-label")?.includes("gp_mt_gross"))
        .every((i) => i.disabled),
    ).toBe(true);
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
    expect(container.textContent).toContain("Data last saved and locked:");
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
});
