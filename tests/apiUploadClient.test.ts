import { setAccessToken } from "../src/lib/apiClient";
import { uploadFileThroughApi, validateUploadFile, validateWorkflowFile } from "../src/lib/uploadClient";

describe("API upload client", () => {
  beforeEach(() => setAccessToken("test-token"));
  afterEach(() => { setAccessToken(null); vi.unstubAllGlobals(); });

  it("accepts a supported small file", () => {
    expect(validateUploadFile(new File(["hello"], "hello.txt", { type: "text/plain" }))).toBeNull();
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(validateUploadFile(new File(["x"], "script.js", { type: "application/javascript" }))).toContain("not allowed");
    expect(validateUploadFile(new File([], "empty.pdf", { type: "application/pdf" }))).toContain("Empty");
    expect(validateUploadFile(new File([new Uint8Array(4_600_000)], "large.pdf", { type: "application/pdf" }))).toContain("limit");
  });

  it("limits spreadsheet-only workflows to XLSX files", () => {
    expect(validateWorkflowFile(new File(["x"], "source.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])).toBeNull();
    expect(validateWorkflowFile(new File(["x"], "source.pdf", { type: "application/pdf" }), ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])).toContain("Excel");
  });

  it("sends an authenticated multipart API upload", async () => {
    class MockXhr {
      static last: MockXhr;
      status = 201;
      responseText = JSON.stringify({ upload: { id: "api-id", workflow: "memo", objectKey: "portal/file.xlsx", originalName: "file.xlsx", size: 5, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", uploadedAt: "2026-07-18T00:00:00Z" } });
      responseType = "";
      upload: { onprogress?: (event: ProgressEvent) => void } = {};
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { MockXhr.last = this; }
      open = vi.fn();
      setRequestHeader = vi.fn();
      send = vi.fn(() => this.onload?.());
    }
    vi.stubGlobal("XMLHttpRequest", MockXhr);
    const file = new File(["hello"], "source.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const response = await uploadFileThroughApi({ id: "browser-id", file, status: "queued", progress: 0 }, "memo", vi.fn());
    expect(response.upload.id).toBe("api-id");
    expect(MockXhr.last.open).toHaveBeenCalledWith("POST", "/api/uploads");
    expect(MockXhr.last.setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer test-token");
  });
});
