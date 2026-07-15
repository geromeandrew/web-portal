import {
  getLambdaUploadBaseUrl,
  uploadFileThroughLambda,
  uploadFileWithProgress,
  validateLambdaFile,
  validateLocalFiles,
} from "../src/lib/uploadClient";

describe("lambda upload client validation", () => {
  it("accepts a supported small file", () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    expect(validateLambdaFile(file)).toBeNull();
  });

  it("rejects unsupported mime types", () => {
    const file = new File(["x"], "script.js", { type: "application/javascript" });

    expect(validateLambdaFile(file)).toContain("not allowed");
  });

  it("rejects files above the lambda upload limit", () => {
    const file = new File([new Uint8Array(4_600_000)], "large.pdf", {
      type: "application/pdf",
    });

    expect(validateLambdaFile(file)).toContain("Lambda upload limit");
  });

  it("rejects empty direct-upload files before requesting a presign", () => {
    const { rejected } = validateLocalFiles([new File([], "empty.pdf", { type: "application/pdf" })]);

    expect(rejected[0]?.reason).toBe("Empty files are not allowed.");
  });

  it("sends a direct upload as a PUT with presigned headers", async () => {
    const originalXhr = globalThis.XMLHttpRequest;

    class MockXhr {
      static last: MockXhr;
      status = 200;
      upload: { onprogress?: (event: ProgressEvent) => void } = {};
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { MockXhr.last = this; }
      open = vi.fn();
      setRequestHeader = vi.fn();
      send = vi.fn(() => this.onload?.());
    }

    vi.stubGlobal("XMLHttpRequest", MockXhr);
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const progress = vi.fn();
    await uploadFileWithProgress({ id: "direct-id", file, status: "ready", progress: 0, uploadUrl: "https://s3.example/upload", headers: { "Content-Type": "text/plain", "x-amz-meta-test": "1" } }, progress);

    expect(MockXhr.last.open).toHaveBeenCalledWith("PUT", "https://s3.example/upload");
    expect(MockXhr.last.setRequestHeader).toHaveBeenCalledWith("Content-Type", "text/plain");
    expect(MockXhr.last.setRequestHeader).toHaveBeenCalledWith("x-amz-meta-test", "1");
    expect(MockXhr.last.send).toHaveBeenCalledWith(file);
    expect(progress).toHaveBeenCalledWith(100);
    vi.stubGlobal("XMLHttpRequest", originalXhr);
  });

  it("sends a Lambda upload with file metadata and accepts its upload response", async () => {
    const originalXhr = globalThis.XMLHttpRequest;

    class MockXhr {
      static last: MockXhr;
      status = 200;
      responseText = JSON.stringify({ upload: { id: "lambda-id", bucket: "private", objectKey: "lambda/hello.txt", size: 5, contentType: "text/plain", uploadedAt: "2026-07-16T00:00:00Z" } });
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
    expect(MockXhr.last.send).toHaveBeenCalledWith(file);
    vi.stubGlobal("XMLHttpRequest", originalXhr);
  });

  it("rejects unexpected successful lambda responses", async () => {
    const originalXhr = globalThis.XMLHttpRequest;

    class MockXhr {
      static last: MockXhr;
      responseText = JSON.stringify({ message: "wrong lambda" });
      status = 200;
      upload = {};
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor() {
        MockXhr.last = this;
      }

      open = vi.fn();
      setRequestHeader = vi.fn();
      send = vi.fn(() => this.onload?.());
    }

    vi.stubGlobal("XMLHttpRequest", MockXhr);

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    await expect(
      uploadFileThroughLambda(
        {
          id: "test-id",
          file,
          status: "queued",
          progress: 0,
        },
        vi.fn(),
      ),
    ).rejects.toThrow("unexpected response");

    expect(MockXhr.last.open).toHaveBeenCalledWith("POST", getLambdaUploadBaseUrl());

    vi.stubGlobal("XMLHttpRequest", originalXhr);
  });
});
