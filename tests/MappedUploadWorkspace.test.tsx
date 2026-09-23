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
});
