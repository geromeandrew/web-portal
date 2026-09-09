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
    expect(container.textContent).toContain("—");

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
    expect(container.querySelector('[aria-label="Remove 308. Billed Adjustments Monthly Summary Report.XLSX"]')).toHaveProperty("disabled", true);
  });
});
