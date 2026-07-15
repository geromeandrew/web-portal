import { validateCandidate, sanitizeName } from "../worker/validation";

const env = {
  AWS_ACCESS_KEY_ID: "key",
  AWS_SECRET_ACCESS_KEY: "secret",
  AWS_REGION: "ap-southeast-1",
  S3_BUCKET_NAME: "bucket",
  MAX_FILE_SIZE_BYTES: "100",
  ALLOWED_MIME_TYPES: "application/pdf,image/png",
};

describe("worker validation", () => {
  it("sanitizes file names", () => {
    expect(sanitizeName("hello world?.pdf")).toBe("hello-world-.pdf");
  });

  it("rejects oversize uploads", () => {
    const result = validateCandidate(
      {
        name: "big.pdf",
        size: 101,
        type: "application/pdf",
      },
      env,
    );

    expect(result).toContain("limit");
  });

  it("rejects unsupported mime types", () => {
    const result = validateCandidate(
      {
        name: "notes.txt",
        size: 80,
        type: "text/plain",
      },
      env,
    );

    expect(result).toContain("not allowed");
  });
});
