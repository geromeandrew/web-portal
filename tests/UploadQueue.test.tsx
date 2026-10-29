import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import UploadQueue from "../src/components/UploadQueue";
import { useUploadProgress } from "../src/lib/useUploadProgress";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Upload progress lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queue: ReturnType<typeof useUploadProgress>;
  function Harness() {
    queue = useUploadProgress();
    return queue.progress ? <UploadQueue progress={queue.progress} /> : null;
  }
  beforeEach(async () => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });
  const bars = () =>
    [...container.querySelectorAll('[role="progressbar"]')].map((bar) =>
      Number(bar.getAttribute("aria-valuenow")),
    );

  it("advances only the active file, waits for server confirmation, and keeps completion visible", async () => {
    await act(async () => {
      queue.begin(["first.xlsx", "second.xlsx"]);
      queue.start("first.xlsx");
    });
    await act(async () => vi.advanceTimersByTime(2500));
    expect(bars()[0]).toBeGreaterThan(25);
    expect(bars()[1]).toBe(0);
    await act(async () => vi.advanceTimersByTime(120_000));
    expect(bars()).toEqual([90, 0]);
    await act(async () => {
      queue.uploaded("first.xlsx");
      queue.start("second.xlsx");
    });
    await act(async () => vi.advanceTimersByTime(1000));
    expect(bars()[0]).toBe(100);
    expect(bars()[1]).toBeGreaterThan(5);
    await act(async () => {
      queue.uploaded("second.xlsx");
      queue.refresh();
    });
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(bars()).toEqual([100, 100]);
    expect(container.textContent).toContain("Updating activity");
    expect(container.textContent).not.toContain("successfully uploaded");
    await act(async () => queue.finish());
    expect(container.textContent).toContain("2 files successfully uploaded");
    await act(async () => vi.advanceTimersByTime(4999));
    expect(bars()).toHaveLength(2);
    await act(async () => vi.advanceTimersByTime(1));
    expect(bars()).toHaveLength(0);
  });

  it("preserves partial success and distinguishes unconfirmed and unstarted files on failure", async () => {
    await act(async () => {
      queue.begin(["first.xlsx", "second.xlsx", "third.xlsx"]);
      queue.start("first.xlsx");
      queue.uploaded("first.xlsx");
      queue.start("second.xlsx");
    });
    await act(async () => vi.advanceTimersByTime(1500));
    await act(async () => {
      queue.refresh("Connection lost");
      queue.finish("Connection lost");
    });
    expect(container.textContent).toContain("1 of 3 files confirmed uploaded");
    expect(container.textContent).toContain("Not confirmed");
    expect(container.textContent).toContain("Not started");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Connection lost",
    );
    const stopped = bars();
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(bars()).toEqual(stopped);
    await act(async () => {
      queue.begin(["retry.xlsx"]);
      queue.start("retry.xlsx");
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(bars()).toEqual([5]);
  });

  it("cannot report success for an incomplete upload queue", async () => {
    await act(async () => {
      queue.begin(["first.xlsx", "second.xlsx"]);
      queue.start("first.xlsx");
      queue.uploaded("first.xlsx");
      queue.refresh();
      queue.finish();
    });
    expect(container.textContent).not.toContain("successfully uploaded");
    expect(container.textContent).toContain(
      "Some files were not confirmed uploaded",
    );
    expect(container.textContent).toContain("1 of 2 files confirmed uploaded");
  });

  it("cleans up animation timers when the progress display is removed", async () => {
    await act(async () => {
      queue.begin(["first.xlsx"]);
      queue.start("first.xlsx");
    });
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => queue.clear());
    expect(vi.getTimerCount()).toBe(0);
  });
});
