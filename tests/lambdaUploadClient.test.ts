import {
  getLambdaUploadBaseUrl,
  uploadFileThroughLambda,
  validateLambdaFile,
  validateWorkflowFile,
} from "../src/lib/uploadClient";

describe("lambda upload client", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_LAMBDA_UPLOAD_URL", "https://lambda-upload.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts a supported small file", () => {
    expect(validateLambdaFile(new File(["hello"], "hello.txt", { type: "text/plain" }))).toBeNull();
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(validateLambdaFile(new File(["x"], "script.js", { type: "application/javascript" }))).toContain("not allowed");
    expect(validateLambdaFile(new File([], "empty.pdf", { type: "application/pdf" }))).toContain("Empty");
    expect(validateLambdaFile(new File([new Uint8Array(4_600_000)], "large.pdf", { type: "application/pdf" }))).toContain("limit");
  });

  it("limits spreadsheet-only workflows to XLSX files", () => {
    expect(validateWorkflowFile(new File(["x"], "source.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])).toBeNull();
    expect(validateWorkflowFile(new File(["x"], "source.pdf", { type: "application/pdf" }), ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])).toContain("Excel");
  });

  it("sends a Lambda upload with file metadata", async () => {
    class MockXhr {
      static last: MockXhr;
      status = 200;
      responseText = JSON.stringify({ upload: { id: "lambda-id", bucket: "private", objectKey: "lambda/hello.txt", size: 5, contentType: "text/plain", uploadedAt: "2026-07-18T00:00:00Z" } });
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
    const file = new File(["hello"], "hello world.txt", { type: "text/plain" });
    const response = await uploadFileThroughLambda({ id: "lambda-id", file, status: "queued", progress: 0 }, vi.fn());

    expect(response.upload.objectKey).toBe("lambda/hello.txt");
    expect(MockXhr.last.open).toHaveBeenCalledWith("POST", getLambdaUploadBaseUrl());
    expect(MockXhr.last.setRequestHeader).toHaveBeenCalledWith("X-File-Name", "hello%20world.txt");
    expect(MockXhr.last.setRequestHeader).toHaveBeenCalledWith("X-File-Size", "5");
  });
});
