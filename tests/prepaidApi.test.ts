import {
  formatMoney,
  uploadSource,
  matchesPrepaidSourceName,
  findPrepaidUploadSource,
} from "../src/lib/prepaidApi";
const auth = vi.hoisted(() => ({
  getAccessTokenForRequest: vi.fn(),
  renewAccessToken: vi.fn(),
  apiRequest: vi.fn(),
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
  it("uses accepted upload names before cycle coverage is configured, retaining strict filenames", () => {
    const source = {
      code: "308_21",
      fileName: "308. Billed Adjustments Monthly Summary Report_G_BC21.XLSX",
    };
    const files = {
      required: [{ code: "ke24", fileName: "KE24.XLSX" }],
      accepted: [source],
      collectionOnly: true,
      missing: [],
      valid: false,
      files: [],
      upstream: null,
    };
    expect(
      findPrepaidUploadSource(files, source.fileName.toLowerCase()),
    ).toEqual(source);
    expect(
      findPrepaidUploadSource(
        files,
        "308. Billed Adjustments Monthly Summary Report_G_BC27.XLSX",
      ),
    ).toBeUndefined();
    expect(
      findPrepaidUploadSource(files, "../" + source.fileName),
    ).toBeUndefined();
    expect(findPrepaidUploadSource(null, source.fileName)).toBeUndefined();
    expect(
      findPrepaidUploadSource({ ...files, accepted: undefined }, "KE24.xlsx")
        ?.code,
    ).toBe("ke24");
  });
  it("uses API-provided legacy aliases without loosening other filenames", () => {
    const source = {
      code: "callcard_eg",
      fileName: "CALLCARD_EG.XLSX",
      acceptedFileNames: ["CALLCARD_EG.XLSX", "EG CALLCARD.xlsx"],
    };
    expect(matchesPrepaidSourceName(source, "eg callcard.XLSX")).toBe(true);
    expect(matchesPrepaidSourceName(source, "CALLCARD_EG.xlsx")).toBe(true);
    expect(matchesPrepaidSourceName(source, "SG CALLCARD.xlsx")).toBe(false);
    expect(matchesPrepaidSourceName(source, "../EG CALLCARD.xlsx")).toBe(false);
    expect(
      matchesPrepaidSourceName(
        { code: "ke24", fileName: "KE24.XLSX" },
        "KE24.xlsx",
      ),
    ).toBe(true);
    expect(
      matchesPrepaidSourceName(
        { code: "ke24", fileName: "KE24.XLSX" },
        "EG CALLCARD.xlsx",
      ),
    ).toBe(false);
  });
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
    form?: FormData;
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
    send(form?: FormData) {
      this.form = form;
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 25,
        total: 100,
      });
      this.status = statuses.shift() ?? 200;
      this.responseText =
        this.status === 503
          ? JSON.stringify({
              error: { code: "PREPAID_UPLOAD_BUSY", message: "Busy" },
            })
          : JSON.stringify({ id: form?.get("uploadId") });
      queueMicrotask(() =>
        this.status === 0 ? this.onerror?.() : this.onload?.(),
      );
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
  it("reconciles a lost response by the exact upload ID without resending or matching an older filename", async () => {
    statuses = [0];
    auth.apiRequest.mockImplementation(async () => ({
      sources: {
        files: [
          { id: instances[0].form!.get("uploadId"), source_code: "ke24" },
        ],
      },
    }));
    const progress = vi.fn();
    await uploadSource(
      "",
      "ke24",
      new File(["PK"], "KE24.XLSX"),
      new AbortController().signal,
      progress,
      true,
    );
    expect(instances).toHaveLength(1);
    expect(progress).toHaveBeenCalledWith(100);
  });
  it("retries an interrupted workspace upload with the same identity", async () => {
    vi.useFakeTimers();
    try {
      statuses = [0, 200];
      auth.apiRequest.mockResolvedValue({ sources: { files: [] } });
      const promise = uploadSource(
        "",
        "ke24",
        new File(["PK"], "KE24.XLSX"),
        new AbortController().signal,
        vi.fn(),
        true,
      );
      await vi.advanceTimersByTimeAsync(1000);
      await promise;
      expect(instances).toHaveLength(2);
      expect(instances[1].form!.get("uploadId")).toBe(
        instances[0].form!.get("uploadId"),
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("waits and retries a known admission rejection, but not arbitrary server errors", async () => {
    vi.useFakeTimers();
    try {
      statuses = [503, 200];
      const promise = uploadSource(
        "",
        "ke24",
        new File(["PK"], "KE24.XLSX"),
        new AbortController().signal,
        vi.fn(),
        true,
      );
      await vi.advanceTimersByTimeAsync(1000);
      await promise;
      expect(instances).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it("sends only two multipart requests at a time when ten files are selected", async () => {
    const held: FakeXHR[] = [];
    vi.spyOn(FakeXHR.prototype, "send").mockImplementation(function (
      this: FakeXHR,
      form,
    ) {
      this.form = form;
      this.status = 200;
      this.responseText = JSON.stringify({ id: form?.get("uploadId") });
      held.push(this);
    });
    try {
      const controllers = Array.from(
        { length: 10 },
        () => new AbortController(),
      );
      const promises = controllers.map((c) =>
        uploadSource(
          "",
          "ke24",
          new File(["PK"], "KE24.XLSX"),
          c.signal,
          vi.fn(),
          true,
        ),
      );
      await vi.waitFor(() => expect(held).toHaveLength(2));
      let ended = 0;
      while (ended < 10) {
        const count = held.length;
        for (; ended < count; ended++) held[ended].onload?.();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      }
      await Promise.all(promises);
      expect(held).toHaveLength(10);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
