import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import MappedUploadWorkspace from "../src/components/MappedUploadWorkspace";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("../src/lib/apiClient", () => api);

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean; }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const workspace = {
  id: "memo-stt",
  title: "Memo STT",
  description: "Upload Memo Standard Template source files.",
  kind: "pipeline" as const,
  pipelineTerms: ["memo", "standard"],
};

describe("MappedUploadWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/processing-pipelines")
        return Promise.resolve({
          pipelines: [{ code: "memo_sst", label: "Memo Standard Template" }],
        });
      if (path === "/processing-pipelines/memo_sst/files")
        return Promise.resolve({
          configured: true,
          files: [{
            id: "memo-1",
            expectedFileName: "3PComms_01.XLSX",
            matchedFileName: null,
            legacyPackageName: null,
            jobName: null,
            availability: "missing",
            key: null,
            size: null,
            lastModified: null,
            stepFunction: null,
          }],
        });
      if (path === "/processing-pipelines/memo_sst/upload-batches")
        return Promise.reject(new Error("Upload history is temporarily unavailable."));
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.apiRequest.mockReset();
  });

  it("keeps file mappings visible when activity history cannot load", async () => {
    await act(async () => {
      root.render(<MappedUploadWorkspace workspace={workspace} history="batches" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("3PComms_01.XLSX");
    expect(container.textContent).toContain("File mappings loaded, but upload activity could not be loaded");
    expect(container.textContent).toContain("Uploaded files will appear here");
  });

  it.each(["flat", "batches"] as const)("shows multiple uploaders in %s history", async (history) => {
    const original = api.apiRequest.getMockImplementation()!;
    api.apiRequest.mockImplementation((path: string) => path.endsWith("/upload-batches")
      ? Promise.resolve({ batches: ["Rodelio", "Lance"].map((uploadedBy, index) => ({
        id: `batch-${index}`, createdAt: "2026-10-01T00:00:00Z", uploadedBy,
        files: [{ expectedFileName: "3PComms_01.XLSX", originalName: "3PComms_01.XLSX", objectKey: "memo_sst/inbound/3PComms_01.XLSX", readAt: "2026-10-01T00:00:00Z" }],
      })) }) : original(path));
    await act(async () => {
      root.render(<MappedUploadWorkspace workspace={workspace} history={history} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("Rodelio");
    expect(container.textContent).toContain("Lance");
  });

  it("rejects oversized files before creating an upload batch", async () => {
    await act(async () => {
      root.render(<MappedUploadWorkspace workspace={workspace} history="batches" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const oversized = new File(["source"], "3PComms_01.XLSX");
    Object.defineProperty(oversized, "size", { value: 209715201 });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [oversized] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(container.textContent).toContain("200 MB per-file size limit");
    expect(api.apiRequest.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("always uses the fixed 200 MB limit even if an older API sends configuration", async () => {
    const original = api.apiRequest.getMockImplementation()!;
    api.apiRequest.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return path.endsWith("/upload-batches") ? { batch: { id: "new-batch" } } : {};
      }
      const result = await original(path);
      return path === "/processing-pipelines" ? { ...result, maxUploadBytes: 1048576 } : result;
    });
    await act(async () => {
      root.render(<MappedUploadWorkspace workspace={workspace} history="batches" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const allowed = new File(["source"], "3PComms_01.XLSX");
    Object.defineProperty(allowed, "size", { value: 2 * 1024 * 1024 });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [allowed] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(api.apiRequest.mock.calls.some(([path, options]) => path.endsWith("/files") && options?.method === "POST")).toBe(true);
    expect(container.textContent).not.toContain("size limit");
    expect(container.textContent).not.toContain("Maximum file size:");
  });
});
