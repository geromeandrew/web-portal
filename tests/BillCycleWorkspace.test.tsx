import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import BillCycleWorkspace from "../src/components/BillCycleWorkspace";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("../src/lib/apiClient", () => api);

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean; }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const workspace = {
  id: "bss-bill-cycle-globe",
  title: "BSS Bill Cycle - Globe",
  description: "Billing cycle dataset upload for Globe enterprise consumer & business accounts",
  kind: "pipeline" as const,
  presentation: "billCycle" as const,
  pipelineTerms: ["bss", "bill", "globe"],
};

const files = [
  {
    id: "308", expectedFileName: "308. Billed Adjustments Monthly Summary Report.XLSX", matchedFileName: "308. Billed Adjustments Monthly Summary Report.XLSX", legacyPackageName: null, jobName: null, availability: "present" as const, key: "308", size: 12, lastModified: "2026-09-03T00:00:00.000Z", stepFunction: { stateMachineName: "bill-cycle", batchCycle: "11", executionInput: {} },
  },
  {
    id: "318", expectedFileName: "318. Billed Charges Summary Report.XLSX", matchedFileName: null, legacyPackageName: null, jobName: null, availability: "missing" as const, key: null, size: null, lastModified: null, stepFunction: { stateMachineName: "bill-cycle", batchCycle: "11", executionInput: {} },
  },
];

describe("BillCycleWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/processing-pipelines") return Promise.resolve({ pipelines: [{ code: "globe-bss", label: "BSS Bill Cycle - Globe" }] });
      if (path === "/processing-pipelines/globe-bss/files") return Promise.resolve({ configured: true, files });
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.apiRequest.mockReset();
  });

  it("renders API-derived bill-cycle history and reveals selected-cycle file guidance", async () => {
    await act(async () => {
      root.render(<BillCycleWorkspace workspace={workspace} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("BSS Bill Cycle - Globe");
    expect(container.textContent).toContain("Bill Cycle 11");
    expect(container.textContent).toContain("Sep 3, 2026");
    expect(container.textContent).toContain("-");

    const select = container.querySelector("#bill-cycle-upload") as HTMLSelectElement;
    await act(async () => {
      select.value = "11";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("308. Billed Adjustments Monthly Summary Report.XLSX");
    expect(container.textContent).toContain("318. Billed Charges Summary Report.XLSX");

    const cycleToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Bill Cycle 11")) as HTMLButtonElement;
    await act(async () => cycleToggle.click());

    expect(container.textContent).toContain("✓ Read");
    expect(container.textContent).toContain("8:00:00 AM");
    const deleteButton = container.querySelector('[aria-label="Remove 308. Billed Adjustments Monthly Summary Report.XLSX"]') as HTMLButtonElement;
    expect(deleteButton).toHaveProperty("disabled", false);
    expect(deleteButton.parentElement?.style.gridTemplateColumns).toContain("2.25rem");
  });

  it("sorts selectors ascending and moves an uploaded cycle to the top expanded", async () => {
    let cycle24Uploaded = false;
    const cycle24 = {
      id: "cycle-24", expectedFileName: "cycle-24.xlsx", matchedFileName: null, legacyPackageName: null, jobName: null, availability: "missing" as const, key: null, size: null, lastModified: null, stepFunction: { stateMachineName: "bill-cycle", batchCycle: "24", executionInput: {} },
    };
    api.apiRequest.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/processing-pipelines") return Promise.resolve({ pipelines: [{ code: "globe-bss", label: "BSS Bill Cycle - Globe" }] });
      if (path === "/processing-pipelines/globe-bss/files" && options?.method === "POST") {
        cycle24Uploaded = true;
        return Promise.resolve({});
      }
      if (path === "/processing-pipelines/globe-bss/files") {
        const refreshedCycle24 = cycle24Uploaded
          ? { ...cycle24, matchedFileName: "cycle-24.xlsx", availability: "present" as const, key: "cycle-24", size: 24, lastModified: "2026-09-04T00:00:00.000Z" }
          : cycle24;
        return Promise.resolve({ configured: true, files: [...files, refreshedCycle24] });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    await act(async () => {
      root.render(<BillCycleWorkspace workspace={workspace} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const select = container.querySelector("#bill-cycle-upload") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["", "11", "24"]);
    await act(async () => {
      select.value = "24";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const cycle11Toggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Bill Cycle 11")) as HTMLButtonElement;
    await act(async () => cycle11Toggle.click());

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["cycle 24"], "cycle-24.xlsx")] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const activityRows = Array.from(container.querySelectorAll("tbody > tr"));
    expect(activityRows[0].textContent).toContain("Bill Cycle 24");
    expect(activityRows[1].textContent).toContain("Read");
    expect(activityRows).toHaveLength(3);
    expect(activityRows[1].textContent).toContain("cycle-24.xlsx");
    expect(activityRows[2].textContent).toContain("Bill Cycle 11");
  });

  it("removes an individual uploaded file after confirmation", async () => {
    let currentFiles = files;
    api.apiRequest.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/processing-pipelines") return Promise.resolve({ pipelines: [{ code: "globe-bss", label: "BSS Bill Cycle - Globe" }] });
      if (path === "/processing-pipelines/globe-bss/files?key=308" && options?.method === "DELETE") {
        currentFiles = files.map((file) => file.id === "308" ? { ...file, matchedFileName: null, availability: "missing" as const, key: null, size: null, lastModified: null } : file);
        return Promise.resolve();
      }
      if (path === "/processing-pipelines/globe-bss/files") return Promise.resolve({ configured: true, files: currentFiles });
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    await act(async () => {
      root.render(<BillCycleWorkspace workspace={workspace} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const cycleToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Bill Cycle 11")) as HTMLButtonElement;
    await act(async () => cycleToggle.click());
    const deleteButton = container.querySelector('[aria-label="Remove 308. Billed Adjustments Monthly Summary Report.XLSX"]') as HTMLButtonElement;
    await act(async () => deleteButton.click());
    const confirmButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Remove") as HTMLButtonElement;
    await act(async () => {
      confirmButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.apiRequest).toHaveBeenCalledWith("/processing-pipelines/globe-bss/files?key=308", { method: "DELETE" });
    expect(container.querySelector('[aria-label="Remove 308. Billed Adjustments Monthly Summary Report.XLSX"]')).toHaveProperty("disabled", true);
  });
});
