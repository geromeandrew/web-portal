// Match the API's two retained upload buffers. Waiting files consume no network
// connection/token renewal; cancellation removes them before an XHR is created.
let active = 0;
const waiting: {
  signal: AbortSignal;
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  abort: () => void;
}[] = [];
function drain() {
  while (active < 2 && waiting.length) {
    const entry = waiting.shift()!;
    entry.signal.removeEventListener("abort", entry.abort);
    if (entry.signal.aborted) {
      entry.reject(new DOMException("Upload cancelled", "AbortError"));
      continue;
    }
    active++;
    let released = false;
    entry.resolve(() => {
      if (!released) {
        released = true;
        active--;
        drain();
      }
    });
  }
}
export function acquirePrepaidUpload(signal: AbortSignal): Promise<() => void> {
  if (signal.aborted)
    return Promise.reject(new DOMException("Upload cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const entry = {
      signal,
      resolve,
      reject,
      abort: () => {
        const index = waiting.indexOf(entry);
        if (index >= 0) waiting.splice(index, 1);
        reject(new DOMException("Upload cancelled", "AbortError"));
      },
    };
    signal.addEventListener("abort", entry.abort, { once: true });
    waiting.push(entry);
    drain();
  });
}
