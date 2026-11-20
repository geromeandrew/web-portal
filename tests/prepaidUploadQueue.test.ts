import { acquirePrepaidUpload } from "../src/lib/prepaidUploadQueue";
describe("Bounded cancellable Prepaid upload queue", () => {
  it("keeps two slots, cancels queued work without sending it, and releases each slot once", async () => {
    const first = await acquirePrepaidUpload(new AbortController().signal),
      second = await acquirePrepaidUpload(new AbortController().signal);
    const cancelled = new AbortController(),
      next = new AbortController();
    const waiting = acquirePrepaidUpload(cancelled.signal);
    const rejected = expect(waiting).rejects.toMatchObject({
      name: "AbortError",
    });
    const started = vi.fn();
    const last = acquirePrepaidUpload(next.signal).then((release) => {
      started();
      return release;
    });
    cancelled.abort();
    await rejected;
    await Promise.resolve();
    expect(started).not.toHaveBeenCalled();
    first();
    first();
    const release = await last;
    expect(started).toHaveBeenCalledOnce();
    second();
    release();
  });
});
