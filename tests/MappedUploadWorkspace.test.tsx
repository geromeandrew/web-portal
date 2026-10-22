import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import MappedUploadWorkspace from "../src/components/MappedUploadWorkspace";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("../src/lib/apiClient", () => api);

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const workspace = {
  id: "memo-stt",
  title: "Memo STT",
  description: "Upload Memo Standard Template source files.",
  kind: "pipeline" as const,
  pipelineTerms: ["memo", "standard"],
};

describe("MappedUploadWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/processing-pipelines")
        return Promise.resolve({
          pipelines: [{ code: "memo_sst", label: "Memo Standard Template" }],
        });
      if (path === "/processing-pipelines/memo_sst/files")
        return Promise.resolve({
          configured: true,
          files: [
            {
              id: "memo-1",
              expectedFileName: "3PComms_01.XLSX",
              matchedFileName: null,
              legacyPackageName: null,
              jobName: null,
              availability: "missing",
              key: null,
              size: null,
              lastModified: null,
              stepFunction: null,
            },
          ],
        });
      if (path === "/processing-pipelines/memo_sst/upload-batches")
        return Promise.reject(
          new Error("Upload history is temporarily unavailable."),
        );
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api.apiRequest.mockReset();
  });

  describe("IBOB filename mapping", () => {
    const expectedNames = ["ACT_ISMS_IB_OB_01.XLSX", "ACT_ISMS_IB_OB_02.XLSX"];

    beforeEach(() => {
      api.apiRequest.mockImplementation(
        async (path: string, options?: RequestInit) => {
          if (options?.method === "POST")
            return path.endsWith("/upload-batches")
              ? { batch: { id: "ibob-batch" } }
              : {};
          if (path.endsWith("/files"))
            return {
              configured: true,
              files: expectedNames.map((expectedFileName, index) => ({
                id: String(index),
                expectedFileName,
                match: "exact",
                availability: "missing",
                key: null,
              })),
            };
          if (path.endsWith("/upload-batches")) return { batches: [] };
          if (path.includes("/requirements?")) return { requirements: [] };
          throw new Error(`Unexpected request: ${path}`);
        },
      );
    });

    const openWorkspace = () =>
      act(async () =>
        root.render(
          <MappedUploadWorkspace
            workspace={workspace}
            pipelineCode="isms_ibob_actzn"
            history="batches"
          />,
        ),
      );

    const selectFiles = async (names: string[], viaDrop = false) => {
      const files = names.map((name) => new File(["workbook bytes"], name));
      if (viaDrop) {
        const dropZone = Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent?.includes("Drop files here"),
        )!;
        const event = new Event("drop", { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", { value: { files } });
        await act(async () => dropZone.dispatchEvent(event));
      } else {
        const input =
          container.querySelector<HTMLInputElement>('input[type="file"]')!;
        Object.defineProperty(input, "files", {
          configurable: true,
          value: files,
        });
        await act(async () =>
          input.dispatchEvent(new Event("change", { bubbles: true })),
        );
      }
      return files;
    };

    it.each([false, true])(
      "uploads repeated Excel extensions with canonical mappings (drag and drop: %s)",
      async (viaDrop) => {
        await openWorkspace();
        const selected = await selectFiles(
          expectedNames.map((name) => `${name}.xlsx`),
          viaDrop,
        );
        const uploads = api.apiRequest.mock.calls.filter(
          ([path, options]) =>
            path.endsWith("/files") && options?.method === "POST",
        );
        expect(uploads).toHaveLength(2);
        uploads.forEach(([, options], index) => {
          const body = options.body as FormData;
          expect(body.get("expectedFileName")).toBe(expectedNames[index]);
          expect(body.get("file")).toBe(selected[index]);
          expect(body.get("replace")).toBe("false");
        });
        expect(container.querySelector('[role="alert"]')).toBeNull();
      },
    );

    it.each(["ACT_ISMS_IB_OB_01.xlsx", "act_isms_ib_ob_02.xlsx.xlsx"])(
      "preserves case-insensitive matching for %s",
      async (name) => {
        await openWorkspace();
        await selectFiles([name]);
        expect(
          api.apiRequest.mock.calls.filter(
            ([path, options]) =>
              path.endsWith("/files") && options?.method === "POST",
          ),
        ).toHaveLength(1);
      },
    );

    it.each([
      "ACT_ISMS_IB_OB_03.XLSX.xlsx",
      "ACT_ISMS_IB_OB_01.csv.xlsx",
      "ACT_ISMS_IB_OB_01.XLSX.csv",
      "ACT_ISMS_IB_OB_01 (1).XLSX.xlsx",
    ])("still rejects an unmapped filename: %s", async (name) => {
      await openWorkspace();
      await selectFiles([name]);
      expect(container.textContent).toContain(
        "not required by the current file mapping",
      );
      expect(
        api.apiRequest.mock.calls.some(
          ([, options]) => options?.method === "POST",
        ),
      ).toBe(false);
    });

    it("rejects two files targeting the same canonical mapping before creating a batch", async () => {
      await openWorkspace();
      await selectFiles([expectedNames[0], `${expectedNames[0]}.xlsx`]);
      expect(container.textContent).toContain(
        "Duplicate files cannot be uploaded in the same batch.",
      );
      expect(
        api.apiRequest.mock.calls.some(
          ([, options]) => options?.method === "POST",
        ),
      ).toBe(false);
    });
  });

  it("loads guidelines and history independently of slow inventory without a catalog round trip", async () => {
    let resolveFiles!: (value: unknown) => void;
    let resolveGuidelines!: (value: unknown) => void;
    let resolveHistory!: (value: unknown) => void;
    api.apiRequest.mockImplementation((path: string) => {
      if (path.endsWith("/files"))
        return new Promise((resolve) => {
          resolveFiles = resolve;
        });
      if (path.includes("/requirements?"))
        return new Promise((resolve) => {
          resolveGuidelines = resolve;
        });
      if (path.endsWith("/upload-batches"))
        return new Promise((resolve) => {
          resolveHistory = resolve;
        });
      throw new Error(`Unnecessary request: ${path}`);
    });
    await act(async () =>
      root.render(
        <MappedUploadWorkspace
          workspace={workspace}
          pipelineCode="memo_sst"
          history="batches"
        />,
      ),
    );
    expect(container.textContent).toContain("Loading file guidelines...");
    expect(container.textContent).toContain("Loading activity history...");
    expect(resolveFiles).toBeTypeOf("function");
    expect(resolveHistory).toBeTypeOf("function");
    expect(
      api.apiRequest.mock.calls.some(
        ([path]) => path === "/processing-pipelines",
      ),
    ).toBe(false);
    await act(async () =>
      resolveGuidelines({
        requirements: [
          {
            id: 1,
            fileName: "3PComms_01.XLSX",
            match: "exact",
            stepFunction: null,
            legacyPackageName: null,
            jobName: null,
          },
        ],
      }),
    );
    expect(container.textContent).toContain("3PComms_01.XLSX");
    expect(container.textContent).not.toContain("Loading file guidelines...");
    expect(container.textContent).not.toContain(
      "Uploaded files will appear here",
    );
    await act(async () =>
      resolveHistory({
        batches: [
          {
            id: "history",
            uploadedBy: "Rodelio",
            createdAt: "2026-10-01T00:00:00Z",
            files: [],
          },
        ],
      }),
    );
    expect(container.textContent).toContain("Rodelio");
    expect(container.textContent).not.toContain("Loading activity history...");
    const dropZone = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Loading workspace files..."),
    )!;
    expect(dropZone.disabled).toBe(true);
    await act(async () =>
      resolveFiles({
        configured: true,
        files: [
          {
            id: "1",
            expectedFileName: "3PComms_01.XLSX",
            availability: "missing",
            key: null,
          },
        ],
      }),
    );
    expect(dropZone.disabled).toBe(false);
  });

  it("does not let late metadata overwrite authoritative inventory mappings", async () => {
    let resolveGuidelines!: (value: unknown) => void;
    const original = api.apiRequest.getMockImplementation()!;
    api.apiRequest.mockImplementation((path: string) =>
      path.includes("/requirements?")
        ? new Promise((resolve) => {
            resolveGuidelines = resolve;
          })
        : path.endsWith("/upload-batches")
          ? Promise.resolve({ batches: [] })
          : original(path),
    );
    await act(async () =>
      root.render(
        <MappedUploadWorkspace
          workspace={workspace}
          pipelineCode="memo_sst"
          history="batches"
        />,
      ),
    );
    expect(container.textContent).toContain("3PComms_01.XLSX");
    await act(async () =>
      resolveGuidelines({
        requirements: [{ id: 999, fileName: "obsolete.xlsx" }],
      }),
    );
    expect(container.textContent).not.toContain("obsolete.xlsx");
    expect(container.textContent).toContain("3PComms_01.XLSX");
  });

  it("does not reintroduce APRM output guidelines when an older API ignores purpose", async () => {
    let resolveFiles!: (value: unknown) => void;
    api.apiRequest.mockImplementation((path: string) => {
      if (path.includes("/requirements?"))
        return Promise.resolve({
          requirements: [
            { id: 1, fileName: "ICEXT_GLB_A_VOICE.TXT", match: "exact" },
            { id: 2, fileName: "ICEXT_GLB_A_VOICE_output.TXT", match: "exact" },
          ],
        });
      if (path.endsWith("/files"))
        return new Promise((resolve) => {
          resolveFiles = resolve;
        });
      if (path.endsWith("/upload-batches"))
        return Promise.resolve({ batches: [] });
      throw new Error(`Unexpected request: ${path}`);
    });
    await act(async () =>
      root.render(
        <MappedUploadWorkspace
          workspace={workspace}
          pipelineCode="aprm_voice_accrual"
          history="batches"
        />,
      ),
    );
    expect(container.textContent).toContain("ICEXT_GLB_A_VOICE.TXT");
    expect(container.textContent).not.toContain("ICEXT_GLB_A_VOICE_output.TXT");
    await act(async () => resolveFiles({ configured: true, files: [] }));
  });

  it("keeps file mappings visible when activity history cannot load", async () => {
    await act(async () => {
      root.render(
        <MappedUploadWorkspace workspace={workspace} history="batches" />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("3PComms_01.XLSX");
    expect(container.textContent).toContain(
      "File mappings loaded, but upload activity could not be loaded",
    );
    expect(container.textContent).toContain("Uploaded files will appear here");
  });

  it.each(["flat", "batches"] as const)(
    "shows multiple uploaders in %s history",
    async (history) => {
      const original = api.apiRequest.getMockImplementation()!;
      api.apiRequest.mockImplementation((path: string) =>
        path.endsWith("/upload-batches")
          ? Promise.resolve({
              batches: ["Rodelio", "Lance"].map((uploadedBy, index) => ({
                id: `batch-${index}`,
                createdAt: "2026-10-01T00:00:00Z",
                uploadedBy,
                files: [
                  {
                    expectedFileName: "3PComms_01.XLSX",
                    originalName: "3PComms_01.XLSX",
                    objectKey: "memo_sst/inbound/3PComms_01.XLSX",
                    readAt: "2026-10-01T00:00:00Z",
                  },
                ],
              })),
            })
          : original(path),
      );
      await act(async () => {
        root.render(
          <MappedUploadWorkspace workspace={workspace} history={history} />,
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(container.textContent).toContain("Rodelio");
      expect(container.textContent).toContain("Lance");
    },
  );

  it("rejects oversized files before creating an upload batch", async () => {
    await act(async () => {
      root.render(
        <MappedUploadWorkspace workspace={workspace} history="batches" />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const oversized = new File(["source"], "3PComms_01.XLSX");
    Object.defineProperty(oversized, "size", { value: 209715201 });
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [oversized] });
    await act(async () =>
      input.dispatchEvent(new Event("change", { bubbles: true })),
    );
    expect(container.textContent).toContain("200 MB per-file size limit");
    expect(
      api.apiRequest.mock.calls.some(
        ([, options]) => options?.method === "POST",
      ),
    ).toBe(false);
  });

  it("recovers after invalid selections and a partial upload failure without a page refresh", async () => {
    const original = api.apiRequest.getMockImplementation()!;
    let attempts = 0,
      uploaded = false;
    const replacements: string[] = [];
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (options?.method === "POST" && path.endsWith("upload-batches"))
          return { batch: { id: "new-batch" } };
        if (options?.method === "POST") {
          attempts++;
          replacements.push(
            (options.body as FormData).get("replace") as string,
          );
          if (attempts === 1) {
            uploaded = true;
            throw new Error("Connection lost after storing file");
          }
          return {};
        }
        if (path.endsWith("upload-batches")) return { batches: [] };
        const result = await original(path);
        if (path.endsWith("/files") && uploaded)
          result.files[0] = {
            ...result.files[0],
            availability: "present",
            key: "memo_sst/inbound/3PComms_01.XLSX",
          };
        return result;
      },
    );
    await act(async () => {
      root.render(
        <MappedUploadWorkspace workspace={workspace} history="batches" />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const send = async (name: string) => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File(["report"], name)],
      });
      await act(async () =>
        input.dispatchEvent(new Event("change", { bubbles: true })),
      );
    };
    await send("invalid.xlsx");
    expect(container.textContent).toContain("not required");
    await send("3PComms_01.XLSX");
    expect(container.textContent).toContain("Connection lost");
    await send("3PComms_01.XLSX");
    expect(attempts).toBe(2);
    expect(replacements).toEqual(["false", "true"]);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it.each(["flat", "batches"] as const)(
    "confirms deletion, preserves history and renders shared status timestamps in %s history",
    async (history) => {
      const original = api.apiRequest.getMockImplementation()!;
      let removed = false;
      api.apiRequest.mockImplementation(
        (path: string, options?: RequestInit) => {
          if (options?.method === "DELETE") {
            removed = true;
            return Promise.resolve();
          }
          if (path.endsWith("upload-batches"))
            return Promise.resolve({
              batches: [
                {
                  id: "batch-1",
                  createdAt: "2026-10-01T00:00:00Z",
                  uploadedBy: "Rodelio",
                  files: [
                    {
                      expectedFileName: "3PComms_01.XLSX",
                      originalName: "3PComms_01.XLSX",
                      objectKey: "memo_sst/inbound/3PComms_01.XLSX",
                      readAt: "2026-10-01T00:00:00Z",
                      removedAt: removed ? "2026-10-22T00:00:00Z" : null,
                    },
                  ],
                },
              ],
            });
          return original(path);
        },
      );
      await act(async () => {
        root.render(
          <MappedUploadWorkspace workspace={workspace} history={history} />,
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      if (history === "batches") {
        const toggle = container.querySelector<HTMLButtonElement>(
          '[aria-expanded="false"]',
        )!;
        await act(async () => toggle.click());
      }
      expect(container.textContent).toContain("\u2713 Read");
      expect(container.textContent).toContain("8:00:00 AM");
      const remove = container.querySelector<HTMLButtonElement>(
        '[aria-label="Remove 3PComms_01.XLSX"]',
      )!;
      const statusRow = remove.closest("tr")!;
      expect(statusRow.querySelectorAll("td").length).toBe(
        history === "batches" ? 5 : 6,
      );
      await act(async () => remove.click());
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
      expect(removed).toBe(false);
      await act(async () =>
        Array.from(container.querySelectorAll("button"))
          .find((button) => button.textContent === "Cancel")!
          .click(),
      );
      expect(removed).toBe(false);
      await act(async () => remove.click());
      await act(async () =>
        Array.from(container.querySelectorAll("button"))
          .find((button) => button.textContent === "Remove")!
          .click(),
      );
      expect(api.apiRequest).toHaveBeenCalledWith(
        "/processing-pipelines/memo_sst/files?key=memo_sst%2Finbound%2F3PComms_01.XLSX",
        { method: "DELETE" },
      );
      expect(container.textContent).toContain("Removed");
      expect(container.textContent).toContain("Rodelio");
      expect(
        container.querySelector('[aria-label="Remove 3PComms_01.XLSX"]'),
      ).toHaveProperty("disabled", true);
    },
  );

  it("always uses the fixed 200 MB limit even if an older API sends configuration", async () => {
    const original = api.apiRequest.getMockImplementation()!;
    api.apiRequest.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return path.endsWith("/upload-batches")
            ? { batch: { id: "new-batch" } }
            : {};
        }
        const result = await original(path);
        return path === "/processing-pipelines"
          ? { ...result, maxUploadBytes: 1048576 }
          : result;
      },
    );
    await act(async () => {
      root.render(
        <MappedUploadWorkspace workspace={workspace} history="batches" />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const allowed = new File(["source"], "3PComms_01.XLSX");
    Object.defineProperty(allowed, "size", { value: 2 * 1024 * 1024 });
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [allowed] });
    await act(async () =>
      input.dispatchEvent(new Event("change", { bubbles: true })),
    );
    expect(
      api.apiRequest.mock.calls.some(
        ([path, options]) =>
          path.endsWith("/files") && options?.method === "POST",
      ),
    ).toBe(true);
    expect(container.textContent).not.toContain("size limit");
    expect(container.textContent).not.toContain("Maximum file size:");
  });
});
