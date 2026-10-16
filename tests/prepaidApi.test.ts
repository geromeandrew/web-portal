import { formatMoney, uploadSource } from "../src/lib/prepaidApi";
const auth = vi.hoisted(() => ({
  getAccessTokenForRequest: vi.fn(),
  renewAccessToken: vi.fn(),
}));
vi.mock("../src/lib/apiClient", () => ({
  ...auth,
  ApiClientError: class extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
describe("Prepaid upload transport", () => {
  let statuses: number[], instances: FakeXHR[];
  class FakeXHR {
    upload: {
      onprogress?: (event: {
        lengthComputable: boolean;
        loaded: number;
        total: number;
      }) => void;
    } = {};
    status = 0;
    responseText = "{}";
    onload?: () => void;
    onabort?: () => void;
    onerror?: () => void;
    headers: Record<string, string> = {};
    url = "";
    constructor() {
      instances.push(this);
    }
    open(_method: string, url: string) {
      this.url = url;
    }
    setRequestHeader(name: string, value: string) {
      this.headers[name] = value;
    }
    send() {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 25,
        total: 100,
      });
      this.status = statuses.shift() ?? 200;
      queueMicrotask(() => this.onload?.());
    }
    abort() {
      this.onabort?.();
    }
  }
  beforeEach(() => {
    statuses = [200];
    instances = [];
    auth.getAccessTokenForRequest.mockResolvedValue("old-token");
    auth.renewAccessToken.mockResolvedValue("new-token");
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
  });
  it("uploads to the session workspace without a financial run ID", async () => {
    await uploadSource(
      "",
      "ke24",
      new File(["PKtest"], "KE24.XLSX"),
      new AbortController().signal,
      () => undefined,
      true,
    );
    expect(instances[0].url).toBe(
      "/api/workflows/prepaid/workspace/sources/ke24",
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  it("reports progress and only finishes after acknowledgement", async () => {
    const progress = vi.fn();
    await uploadSource(
      "run",
      "ke24",
      new File(["PK"], "KE24.XLSX"),
      new AbortController().signal,
      progress,
    );
    expect(progress.mock.calls.map((c) => c[0])).toEqual([25, 100]);
    expect(instances[0].headers.Authorization).toBe("Bearer old-token");
  });
  it("renews a 401 once, without repeated retry", async () => {
    statuses = [401, 401];
    await expect(
      uploadSource(
        "run",
        "ke24",
        new File(["PK"], "KE24.XLSX"),
        new AbortController().signal,
        vi.fn(),
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(auth.renewAccessToken).toHaveBeenCalledTimes(1);
    expect(instances[1].headers.Authorization).toBe("Bearer new-token");
  });
  it("does not send an already-cancelled upload", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      uploadSource(
        "run",
        "ke24",
        new File(["PK"], "KE24.XLSX"),
        controller.signal,
        vi.fn(),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(instances).toHaveLength(0);
  });
  it("aborts an in-flight transfer and never announces completion", async () => {
    const controller = new AbortController(),
      progress = vi.fn(() => controller.abort());
    await expect(
      uploadSource(
        "run",
        "ke24",
        new File(["PK"], "KE24.XLSX"),
        controller.signal,
        progress,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(progress).not.toHaveBeenCalledWith(100);
  });
  it("does not treat a server failure as an uploaded file", async () => {
    statuses = [500];
    const progress = vi.fn();
    await expect(
      uploadSource(
        "run",
        "ke24",
        new File(["PK"], "KE24.XLSX"),
        new AbortController().signal,
        progress,
      ),
    ).rejects.toMatchObject({ status: 500 });
    expect(progress).not.toHaveBeenCalledWith(100);
  });
  it("preserves large decimal amounts in display without float conversion", () => {
    expect(formatMoney("-123456789012345678901.12")).toBe(
      "-123,456,789,012,345,678,901.12",
    );
    expect(formatMoney(null)).toBe("");
    expect(formatMoney("999999999999999999999.995", 2)).toBe(
      "1,000,000,000,000,000,000,000.00",
    );
    expect(formatMoney("-0.004", 2)).toBe("0.00");
  });
});
