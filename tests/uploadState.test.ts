import { updateQueueItem } from "../src/lib/uploadState";

describe("upload state helpers", () => {
  it("patches a single API queue item", () => {
    const item = { id: "upload-id", file: new File(["x"], "sample.pdf", { type: "application/pdf" }), status: "queued" as const, progress: 0 };
    const [updated] = updateQueueItem([item], item.id, { progress: 55, status: "uploading" });
    expect(updated.progress).toBe(55);
    expect(updated.status).toBe("uploading");
  });
});
