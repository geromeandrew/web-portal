import { createUploadId } from "../src/lib/uploadId";

describe("createUploadId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when it is available", () => {
    const randomUUID = vi.fn(() => "secure-id");
    vi.stubGlobal("crypto", { randomUUID });

    expect(createUploadId()).toBe("secure-id");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("falls back to a client identifier when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});

    expect(createUploadId()).toMatch(/^upload-[a-z0-9]+-[a-z0-9]+$/);
  });
});
