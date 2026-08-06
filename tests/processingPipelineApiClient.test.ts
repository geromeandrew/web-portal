import { apiRequest, fetchApiFile, setAccessToken } from "../src/lib/apiClient";

describe("Processing Pipeline file client", () => {
  beforeEach(() => setAccessToken("test-token"));
  afterEach(() => { setAccessToken(null); vi.unstubAllGlobals(); });

  it("loads a selected object through the authenticated API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("file contents", { headers: { "content-type": "text/plain" } }));
    vi.stubGlobal("fetch", fetchMock);

    const file = await fetchApiFile("/processing-pipelines/alpha/files/content?stage=inbound&key=alpha%2Finbound%2Fsource.txt");

    expect(fetchMock).toHaveBeenCalledWith("/api/processing-pipelines/alpha/files/content?stage=inbound&key=alpha%2Finbound%2Fsource.txt", { headers: { Authorization: "Bearer test-token" } });
    expect(file.contentType).toBe("text/plain");
    await expect(file.blob.text()).resolves.toBe("file contents");
  });

  it("starts a mapped Glue job through the authenticated API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobRunId: "jr_123", jobName: "MyBSS_Bayan_EOC01_P10_308-Billed-Adjustments-01", startedAt: "2026-07-31T09:00:00.000Z" }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/processing-pipelines/bss_billcycle_bayn/runs", { method: "POST", body: JSON.stringify({ stage: "inbound", expectedFileName: "308. Billed Adjustments Monthly Summary Report_B_01.xlsx" }) })).resolves.toMatchObject({ jobRunId: "jr_123" });
    expect(fetchMock).toHaveBeenCalledWith("/api/processing-pipelines/bss_billcycle_bayn/runs", expect.objectContaining({ method: "POST", headers: expect.any(Headers) }));
  });

  it("retrieves a mapped Glue job run status through the authenticated API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobRunId: "jr_123", jobName: "MyBSS_Bayan_EOC01_P10_308-Billed-Adjustments-01", status: "RUNNING", errorMessage: null, startedAt: "2026-07-31T09:00:00.000Z", completedAt: null, glueConsoleUrl: "https://console.aws.amazon.com/glue", cloudWatchLogsUrl: "https://console.aws.amazon.com/cloudwatch" }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/processing-pipelines/bss_billcycle_bayn/runs/jr_123?stage=inbound&expectedFileName=308.1.xlsx")).resolves.toMatchObject({ status: "RUNNING" });
    expect(fetchMock).toHaveBeenCalledWith("/api/processing-pipelines/bss_billcycle_bayn/runs/jr_123?stage=inbound&expectedFileName=308.1.xlsx", expect.objectContaining({ headers: expect.any(Headers) }));
  });
});
