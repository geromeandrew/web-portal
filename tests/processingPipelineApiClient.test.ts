import { apiRequest, fetchApiFile, setAccessTokenProviderForTests } from "../src/lib/apiClient";
import { setOktaAuthEnabledForTests } from "../src/auth/authMode";

describe("Processing Pipeline file client", () => {
  beforeEach(() => { setOktaAuthEnabledForTests(true); setAccessTokenProviderForTests({ get: async () => "test-token", renew: async () => "renewed-token" }); });
  afterEach(() => { setOktaAuthEnabledForTests(null); setAccessTokenProviderForTests(null); vi.unstubAllGlobals(); });

  it("loads a selected object through the authenticated API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("file contents", { headers: { "content-type": "text/plain" } }));
    vi.stubGlobal("fetch", fetchMock);

    const file = await fetchApiFile("/processing-pipelines/alpha/files/content?key=alpha%2Finbound%2Fsource.txt");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/processing-pipelines/alpha/files/content?key=alpha%2Finbound%2Fsource.txt",
      expect.objectContaining({ credentials: "same-origin", headers: expect.any(Headers) }),
    );
    expect(file.contentType).toBe("text/plain");
    expect(file.blob.size).toBeGreaterThan(0);
  });

  it("renews the Okta token once after an API 401", async () => {
    const renew = vi.fn().mockResolvedValue("renewed-token");
    setAccessTokenProviderForTests({
      get: async () => "expired-token",
      renew,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/auth/me")).resolves.toEqual({ status: "ok" });
    expect(renew).toHaveBeenCalledOnce();
    expect(
      (fetchMock.mock.calls[1][1].headers as Headers).get("Authorization"),
    ).toBe("Bearer renewed-token");
  });

  it("calls the API without a bearer token while temporary auth is enabled", async () => {
    setOktaAuthEnabledForTests(false);
    setAccessTokenProviderForTests(null);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ pipelines: [] }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/processing-pipelines");

    expect((fetchMock.mock.calls[0][1].headers as Headers).get("Authorization")).toBeNull();
  });

  it("starts a mapped Glue job through the authenticated API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ runId: "a5a510ec-53b3-4cbd-929c-cce3197f0eb4", targetMode: "adhoc", stateMachineName: "Bayan-308", executionInput: {}, startedAt: "2026-07-31T09:00:00.000Z" }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/processing-pipelines/bss_billcycle_bayn/runs", { method: "POST", body: JSON.stringify({ expectedFileName: "308. Billed Adjustments Monthly Summary Report_B_01.xlsx" }) })).resolves.toMatchObject({ runId: "a5a510ec-53b3-4cbd-929c-cce3197f0eb4" });
    expect(fetchMock).toHaveBeenCalledWith("/api/processing-pipelines/bss_billcycle_bayn/runs", expect.objectContaining({ method: "POST", headers: expect.any(Headers) }));
  });

  it("retrieves a mapped Glue job run status through the authenticated API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ runId: "a5a510ec-53b3-4cbd-929c-cce3197f0eb4", targetMode: "adhoc", stateMachineName: "Bayan-308", status: "RUNNING", errorCode: null, errorMessage: null, startedAt: "2026-07-31T09:00:00.000Z", completedAt: null, stepFunctionsConsoleUrl: "https://console.aws.amazon.com/states" }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/processing-pipelines/bss_billcycle_bayn/runs/a5a510ec-53b3-4cbd-929c-cce3197f0eb4")).resolves.toMatchObject({ status: "RUNNING" });
    expect(fetchMock).toHaveBeenCalledWith("/api/processing-pipelines/bss_billcycle_bayn/runs/a5a510ec-53b3-4cbd-929c-cce3197f0eb4", expect.objectContaining({ headers: expect.any(Headers) }));
  });

  it("loads and starts a batch execution through the authenticated API", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ batchCycle: "01", targetMode: "batch", sourceFiles: [], missingFiles: [], execution: {}, canExecute: true, blockingReasons: [] }), { headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ batchCycle: "01", targetMode: "batch", runId: "a5a510ec-53b3-4cbd-929c-cce3197f0eb4", sourceFiles: [] }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/processing-pipelines/bss_billcycle_bayn/batch-execution-details?batchCycle=01");
    await apiRequest("/processing-pipelines/bss_billcycle_bayn/batch-runs", { method: "POST", body: JSON.stringify({ batchCycle: "01" }) });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/processing-pipelines/bss_billcycle_bayn/batch-execution-details?batchCycle=01", expect.objectContaining({ headers: expect.any(Headers) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/processing-pipelines/bss_billcycle_bayn/batch-runs", expect.objectContaining({ method: "POST", headers: expect.any(Headers) }));
  });
});
