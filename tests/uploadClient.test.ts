import { MAX_UPLOAD_BYTES, validateFileSize, validateWorkflowFile } from "../src/lib/uploadClient";

describe("upload size validation", () => {
  it.each([MAX_UPLOAD_BYTES - 1, MAX_UPLOAD_BYTES])("accepts %s bytes", (size) => {
    expect(validateFileSize({ name: "source.txt", size })).toBeNull();
  });
  it("rejects one byte above 200 MiB and reports the limit", () => {
    expect(validateFileSize({ name: "source.txt", size: MAX_UPLOAD_BYTES + 1 })).toContain("200 MB");
  });
  it("retains workflow MIME validation", () => {
    expect(validateWorkflowFile(new File(["text"], "file.txt", { type: "text/plain" }), ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])).toContain("Excel");
  });
});
