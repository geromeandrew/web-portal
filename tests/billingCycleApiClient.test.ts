import { fetchApiFile, setAccessToken } from "../src/lib/apiClient";

describe("Billing Cycle file client", () => {
  beforeEach(() => setAccessToken("test-token"));
  afterEach(() => { setAccessToken(null); vi.unstubAllGlobals(); });

  it("loads a selected object through the authenticated API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("file contents", { headers: { "content-type": "text/plain" } }));
    vi.stubGlobal("fetch", fetchMock);

    const file = await fetchApiFile("/billing-cycle/files/content?pipeline_name=alpha&status=inbound&key=alpha%2Finbound%2Fsource.txt");

    expect(fetchMock).toHaveBeenCalledWith("/api/billing-cycle/files/content?pipeline_name=alpha&status=inbound&key=alpha%2Finbound%2Fsource.txt", { headers: { Authorization: "Bearer test-token" } });
    expect(file.contentType).toBe("text/plain");
    await expect(file.blob.text()).resolves.toBe("file contents");
  });
});
