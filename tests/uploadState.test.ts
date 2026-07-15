import { applyPresignResponse, toQueueItems, updateQueueItem } from "../src/lib/uploadState";

describe("upload state helpers", () => {
  it("creates queued items from files", () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const [item] = toQueueItems([file]);

    expect(item.file.name).toBe("hello.txt");
    expect(item.status).toBe("queued");
    expect(item.progress).toBe(0);
  });

  it("applies presigned response metadata", () => {
    const file = new File(["x"], "sample.pdf", { type: "application/pdf" });
    const [item] = toQueueItems([file]);

    const response = {
      uploads: [
        {
          id: item.id,
          objectKey: "uploads/2026/06/12/a/sample.pdf",
          uploadUrl: "https://example.com",
          method: "PUT" as const,
          headers: { "Content-Type": "application/pdf" },
          expiresAt: "2026-06-12T00:00:00.000Z",
        },
      ],
    };

    const [updated] = applyPresignResponse([item], response);
    expect(updated.status).toBe("ready");
    expect(updated.objectKey).toContain("sample.pdf");
  });

  it("patches a single queue item", () => {
    const file = new File(["x"], "sample.pdf", { type: "application/pdf" });
    const [item] = toQueueItems([file]);

    const [updated] = updateQueueItem([item], item.id, { progress: 55, status: "uploading" });
    expect(updated.progress).toBe(55);
    expect(updated.status).toBe("uploading");
  });
});
