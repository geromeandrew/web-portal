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

  it.each([false, true])(
    "keeps upload completion and existing history visible until refresh settles (refresh fails: %s)",
    async (refreshFails) => {
      const original = api.apiRequest.getMockImplementation()!;
      let save!: () => void;
      let refresh!: () => void;
      let saved = false;
      const batch = {
        id: "old-batch",
        createdAt: "2026-10-23T01:27:00Z",
        uploadedBy: "Original uploader",
        files: [
          {
            originalName: "existing.xlsx",
            expectedFileName: "3PComms_01.XLSX",
            objectKey: "old-key",
            readAt: "2026-10-23T01:27:00Z",
          },
        ],
      };
      api.apiRequest.mockImplementation(
        async (path: string, options?: RequestInit) => {
          if (options?.method === "POST") {
            if (path.endsWith("/upload-batches"))
              return {
                batch: { id: "new-batch" },
                files: [
                  {
                    originalName: "3PComms_20261023_anything.xlsx",
                    expectedFileName: "3PComms_01.XLSX",
                    savedFileName: "3PComms_02.XLSX",
                  },
                ],
              };
            return new Promise<void>((resolve) => {
              save = () => {
                saved = true;
                resolve();
              };
            });
          }
          if (path.endsWith("/upload-batches")) {
            if (!saved) return { batches: [batch] };
            return new Promise((resolve, reject) => {
              refresh = () =>
                refreshFails
                  ? reject(new Error("Activity unavailable"))
                  : resolve({ batches: [batch] });
            });
          }
          return original(path, options);
        },
      );
      await act(async () =>
        root.render(
          <MappedUploadWorkspace
            workspace={workspace}
            pipelineCode="memo_sst"
            history="flat"
          />,
        ),
      );
      const input = container.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", {
        value: [new File(["source"], "3PComms_20261023_anything.xlsx")],
      });
      await act(async () =>
        input.dispatchEvent(new Event("change", { bubbles: true })),
      );
      expect(
        container
          .querySelector('[role="progressbar"]')
          ?.getAttribute("aria-valuenow"),
      ).toBe("5");
      await act(async () => save());
      expect(
        container
          .querySelector('[role="progressbar"]')
          ?.getAttribute("aria-valuenow"),
      ).toBe("100");
      expect(container.textContent).toContain("existing.xlsx");
      expect(container.textContent).not.toContain(
        "Loading activity history...",
      );
      expect(container.textContent).not.toContain("successfully uploaded");
      const dropZone = container.querySelector(
        'section[aria-labelledby="file-upload-heading"] button',
      )!;
      expect(dropZone).toHaveProperty("disabled", true);
      await act(async () => refresh());
      expect(dropZone).toHaveProperty("disabled", false);
      expect(container.textContent).toContain(
        refreshFails ? "Activity unavailable" : "1 file successfully uploaded",
      );
      expect(container.textContent).toContain("existing.xlsx");
      if (refreshFails)
        expect(container.textContent).not.toContain("successfully uploaded");
    },
  );

  it.each(["flat", "batches"] as const)(
    "shows the uploader on each file in %s history",
    async (history) => {
      const original = api.apiRequest.getMockImplementation()!;
      api.apiRequest.mockImplementation((path: string) =>
        path.endsWith("/upload-batches")
          ? Promise.resolve({
              batches: [
                {
                  id: "batch-with-uploader",
                  createdAt: "2026-10-23T01:27:00Z",
                  uploadedBy: "Batch owner",
                  files: [
                    {
                      originalName: "report.xlsx",
                      expectedFileName: "3PComms_01.XLSX",
                      objectKey: "key",
                      readAt: "2026-10-23T01:27:00Z",
                      uploadedBy: "File uploader",
                    },
                  ],
                },
              ],
            })
          : original(path),
      );
      await act(async () =>
        root.render(
          <MappedUploadWorkspace
            workspace={workspace}
            pipelineCode="memo_sst"
            history={history}
          />,
        ),
      );
      if (history === "batches")
        await act(async () =>
          (
            container.querySelector(
              "button[aria-expanded]",
            ) as HTMLButtonElement
          ).click(),
        );
      const row = [...container.querySelectorAll("tbody tr")].find((row) =>
        row.textContent?.includes("report.xlsx"),
      )!;
      expect(row.querySelectorAll("td")[1].textContent).toBe("File uploader");
    },
  );

  it.each(["memo_sst", "aprm_voice_accrual"])(
    "expands only the newest batch after each upload in %s",
    async (pipelineCode) => {
      const expectedFileName =
        pipelineCode === "memo_sst"
          ? "3PComms_01.XLSX"
          : "AUR Extract FINAL.XLSX";
      const originalName =
        pipelineCode === "memo_sst"
          ? "3PComms_10272026.xlsx"
          : "October AUR Extract export.xlsx";
      const makeBatch = (id: string, day: number, name: string) => ({
        id,
        createdAt: `2026-10-${day}T12:00:00Z`,
        uploadedBy: "Uploader",
        files: [
          {
            expectedFileName,
            originalName: name,
            objectKey: `${pipelineCode}/inbound/${id}.XLSX`,
            readAt: `2026-10-${day}T12:00:00Z`,
            removedAt: null,
          },
        ],
      });
      let batches = [
        makeBatch("old-1", 25, "older-one.xlsx"),
        makeBatch("old-2", 24, "older-two.xlsx"),
      ];
      let nextBatch: ReturnType<typeof makeBatch>;
      let uploads = 0;
      api.apiRequest.mockImplementation(
        async (path: string, options?: RequestInit) => {
          if (path.endsWith("/upload-batches") && options?.method === "POST") {
            nextBatch = makeBatch(
              `new-${uploads + 1}`,
              27 + uploads,
              originalName,
            );
            return {
              batch: { id: nextBatch.id },
              files: [
                {
                  originalName,
                  expectedFileName,
                  savedFileName: expectedFileName,
                },
              ],
            };
          }
          if (path.endsWith("/files") && options?.method === "POST") {
            uploads++;
            batches = [nextBatch, ...batches];
            return {};
          }
          if (path.endsWith("/files"))
            return {
              configured: true,
              files: [
                {
                  id: "mapped",
                  expectedFileName,
                  match: "exact",
                  availability: uploads ? "present" : "missing",
                  key: uploads
                    ? `${pipelineCode}/inbound/${expectedFileName}`
                    : null,
                },
              ],
            };
          if (path.endsWith("/upload-batches")) return { batches };
          if (path.includes("/requirements?")) return { requirements: [] };
          throw new Error(`Unexpected request: ${path}`);
        },
      );
      await act(async () =>
        root.render(
          <MappedUploadWorkspace
            workspace={workspace}
            pipelineCode={pipelineCode}
            history="batches"
          />,
        ),
      );
      const toggles = () =>
        Array.from(
          container.querySelectorAll<HTMLButtonElement>(
            "button[aria-expanded]",
          ),
        );
      await act(async () => {
        toggles().forEach((button) => button.click());
      });
      expect(
        toggles().map((button) => button.getAttribute("aria-expanded")),
      ).toEqual(["true", "true"]);
      const input =
        container.querySelector<HTMLInputElement>('input[type="file"]')!;
      for (const attempt of [1, 2]) {
        if (attempt === 2) await act(async () => toggles()[1].click());
        Object.defineProperty(input, "files", {
          configurable: true,
          value: [new File(["workbook"], originalName)],
        });
        await act(async () =>
          input.dispatchEvent(new Event("change", { bubbles: true })),
        );
        expect(toggles()).toHaveLength(2 + attempt);
        expect(
          toggles().map((button) => button.getAttribute("aria-expanded")),
        ).toEqual(["true", ...Array(1 + attempt).fill("false")]);
        expect(container.textContent).not.toContain("older-one.xlsx");
        expect(container.textContent).not.toContain("older-two.xlsx");
        expect(container.querySelector('[role="alert"]')).toBeNull();
      }
    },
  );

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

  describe("APRM Accrual AUR filename matching", () => {
    beforeEach(() => {
      api.apiRequest.mockImplementation(
        async (path: string, options?: RequestInit) => {
          if (options?.method === "POST")
            return path.endsWith("/upload-batches")
              ? { batch: { id: "aur-batch" } }
              : {};
          if (path.endsWith("/files"))
            return {
              configured: true,
              files: [
                {
                  id: "aur",
                  expectedFileName: "AUR Extract FINAL.XLSX",
                  match: "exact",
                  availability: "missing",
                  key: null,
                },
              ],
            };
          if (path.endsWith("/upload-batches")) return { batches: [] };
          if (path.includes("/requirements?")) return { requirements: [] };
          throw new Error(`Unexpected request: ${path}`);
        },
      );
    });
    const open = () =>
      act(async () =>
        root.render(
          <MappedUploadWorkspace
            workspace={workspace}
            pipelineCode="aprm_voice_accrual"
            history="batches"
          />,
        ),
      );
    const select = (names: string[]) => {
      const input = container.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", {
        value: names.map((name) => new File(["sample"], name)),
      });
      return act(async () =>
        input.dispatchEvent(new Event("change", { bubbles: true })),
      );
    };

    it.each([
      "AUR Extract.xlsx",
      "AUR Extract_10262026.xlsx",
      "AUR Extract_20261026_any_suffix.XLSX",
      "monthly_AUR Extract_10262026.xlsx",
      "AUR Extract - Sep 1 to 30 - FINAL.xlsx",
      "monthly AUR Extract 20261027.XLSX",
    ])("maps %s to the required AUR filename", async (name) => {
      await open();
      await select([name]);
      const uploads = api.apiRequest.mock.calls.filter(
        ([path, options]) =>
          path.endsWith("/files") && options?.method === "POST",
      );
      expect(uploads).toHaveLength(1);
      expect((uploads[0][1].body as FormData).get("expectedFileName")).toBe(
        "AUR Extract FINAL.XLSX",
      );
      expect(((uploads[0][1].body as FormData).get("file") as File).name).toBe(
        name,
      );
      expect(container.querySelector('[role="alert"]')).toBeNull();
    });
    it("accepts AUR files against the legacy mapping during a rolling deployment and deduplicates guidelines", async () => {
      const original = api.apiRequest.getMockImplementation()!;
      api.apiRequest.mockImplementation(
        async (path: string, options?: RequestInit) => {
          const response = await original(path, options);
          if (path.endsWith("/files") && options?.method !== "POST") {
            response.files = ["legacy", "current"].map((id) => ({
              ...response.files[0],
              id,
              expectedFileName: "AUR Extract FINAL_BILLING.XLSX",
            }));
          }
          return response;
        },
      );
      await open();
      expect(
        [
          ...container.querySelectorAll(
            '[aria-labelledby="file-upload-heading"] li',
          ),
        ].map((node) => node.textContent),
      ).toEqual(["AUR Extract FINAL_BILLING.XLSX"]);
      await select(["AUR Extract_10262026.xlsx"]);
      const uploads = api.apiRequest.mock.calls.filter(
        ([path, options]) =>
          path.endsWith("/files") && options?.method === "POST",
      );
      expect(uploads).toHaveLength(1);
      expect((uploads[0][1].body as FormData).get("expectedFileName")).toBe(
        "AUR Extract FINAL_BILLING.XLSX",
      );
      expect(container.querySelector('[role="alert"]')).toBeNull();
    });
    it.each([
      "AUR.xlsx",
      "AUR Extractor.xlsx",
      "October AUR export.xlsx",
      "Usage export.xlsx",
      "AU_R.xlsx",
      "AUR Extract.csv",
    ])("rejects %s", async (name) => {
      await open();
      await select([name]);
      expect(container.textContent).toContain(
        "not required by the current file mapping",
      );
      expect(
        api.apiRequest.mock.calls.some(
          ([, options]) => options?.method === "POST",
        ),
      ).toBe(false);
    });
    it("rejects multiple AUR workbooks targeting the single canonical file in one batch", async () => {
      await open();
      await select(["AUR Extract 20261026.xlsx", "AUR Extract 20261027.xlsx"]);
      expect(container.textContent).toContain("Duplicate files");
      expect(
        api.apiRequest.mock.calls.some(
          ([, options]) => options?.method === "POST",
        ),
      ).toBe(false);
    });
  });

  describe("Memo date suffix batches", () => {
    const plan = [
      {
        originalName: "3PComms_20261023_0127.xlsx",
        expectedFileName: "3PComms_01.XLSX",
        savedFileName: "3PComms_02.XLSX",
      },
      {
        originalName: "3PComms_20261023_0128.xlsx",
        expectedFileName: "3PComms_01.XLSX",
        savedFileName: "3PComms_03.XLSX",
      },
    ];
    beforeEach(() => {
      api.apiRequest.mockImplementation(
        async (path: string, options?: RequestInit) => {
          if (options?.method === "POST")
            return path.endsWith("/upload-batches")
              ? { batch: { id: "memo-batch" }, files: plan }
              : {};
          if (path.endsWith("/files"))
            return {
              configured: true,
              files: [
                {
                  id: "1",
                  expectedFileName: "3PComms_01.XLSX",
                  availability: "present",
                  matchedFileName: "3PComms_01.XLSX",
                  key: "memo_sst/inbound/3PComms_01.XLSX",
                },
              ],
            };
          if (path.endsWith("/upload-batches")) return { batches: [] };
          if (path.includes("/requirements?")) return { requirements: [] };
          throw new Error(`Unexpected request: ${path}`);
        },
      );
    });

    it("rejects an incomplete server upload plan before writing any files", async () => {
      const original = api.apiRequest.getMockImplementation()!;
      api.apiRequest.mockImplementation(
        async (path: string, options?: RequestInit) => {
          const response = await original(path, options);
          if (path.endsWith("/upload-batches") && options?.method === "POST")
            response.files = [plan[0]];
          return response;
        },
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
      const input = container.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", {
        value: plan.map((entry) => new File(["source"], entry.originalName)),
      });
      await act(async () =>
        input.dispatchEvent(new Event("change", { bubbles: true })),
      );
      expect(container.textContent).toContain(
        "Memo upload plan could not be loaded",
      );
      expect(container.textContent).not.toContain("successfully uploaded");
      expect(
        api.apiRequest.mock.calls.some(
          ([path, options]) =>
            path.endsWith("/files") && options?.method === "POST",
        ),
      ).toBe(false);
    });

    it.each([false, true])(
      "uses the server's date order for a batch selected in reverse order (drop: %s)",
      async (viaDrop) => {
        await act(async () =>
          root.render(
            <MappedUploadWorkspace
              workspace={workspace}
              pipelineCode="memo_sst"
              history="batches"
            />,
          ),
        );
        const files = [...plan]
          .reverse()
          .map((entry) => new File([entry.originalName], entry.originalName));
        if (viaDrop) {
          const button = Array.from(container.querySelectorAll("button")).find(
            (item) => item.textContent?.includes("Drop files here"),
          )!;
          const event = new Event("drop", { bubbles: true, cancelable: true });
          Object.defineProperty(event, "dataTransfer", { value: { files } });
          await act(async () => button.dispatchEvent(event));
        } else {
          const input = container.querySelector('input[type="file"]')!;
          Object.defineProperty(input, "files", { value: files });
          await act(async () =>
            input.dispatchEvent(new Event("change", { bubbles: true })),
          );
        }
        const batchRequest = api.apiRequest.mock.calls.find(
          ([path, options]) =>
            path.endsWith("/upload-batches") && options?.method === "POST",
        )!;
        expect(JSON.parse(batchRequest[1].body)).toEqual({
          files: [...plan]
            .reverse()
            .map(({ originalName, expectedFileName }) => ({
              originalName,
              expectedFileName,
            })),
        });
        const uploads = api.apiRequest.mock.calls.filter(
          ([path, options]) =>
            path.endsWith("/files") && options?.method === "POST",
        );
        expect(uploads).toHaveLength(2);
        expect(
          uploads.map(([, options]) => (options.body as FormData).get("file")),
        ).toEqual([...files].reverse());
        expect(
          uploads.map(([, options]) =>
            (options.body as FormData).get("replace"),
          ),
        ).toEqual(["false", "false"]);
        expect(
          uploads.every(
            ([, options]) =>
              (options.body as FormData).get("batchId") === "memo-batch",
          ),
        ).toBe(true);
        expect(container.querySelector('[role="alert"]')).toBeNull();
      },
    );

    it("shows each Memo base once before and after uploading multiple variants", async () => {
      const original = api.apiRequest.getMockImplementation()!;
      let uploaded = false;
      api.apiRequest.mockImplementation(
        async (path: string, options?: RequestInit) => {
          if (path.endsWith("/files") && options?.method === "POST")
            uploaded = true;
          if (path.endsWith("/files") && options?.method !== "POST")
            return {
              configured: true,
              files: [
                ...Array.from({ length: uploaded ? 5 : 4 }, (_, index) => ({
                  id: `3p-${index}`,
                  expectedFileName: "3PComms_01.XLSX",
                  matchedFileName: `3PComms_0${index + 1}.XLSX`,
                  availability: "present",
                  key: `memo_sst/inbound/3PComms_0${index + 1}.XLSX`,
                })),
                ...["BillsPrinting", "Dental", "LeasedLinesV1"].map((name) => ({
                  id: name,
                  expectedFileName: `${name}_01.XLSX`,
                  availability: "missing",
                  key: null,
                })),
              ],
            };
          return original(path, options);
        },
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
      const displayed = () =>
        Array.from(
          container.querySelectorAll(
            '[aria-labelledby="file-upload-heading"] ul li',
          ),
        ).map((item) => item.textContent);
      const expected = [
        "3PComms_",
        "BillsPrinting_",
        "Dental_",
        "LeasedLinesV1_",
      ];
      expect(displayed()).toEqual(expected);
      expect(container.textContent).toContain(
        "All files must follow the correct file name convention:",
      );
      const input = container.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", {
        value: plan.map((file) => new File(["sample"], file.originalName)),
      });
      await act(async () =>
        input.dispatchEvent(new Event("change", { bubbles: true })),
      );
      expect(displayed()).toEqual(expected);
      const uploads = api.apiRequest.mock.calls.filter(
        ([path, options]) =>
          path.endsWith("/files") && options?.method === "POST",
      );
      expect(uploads).toHaveLength(2);
      for (const [, options] of uploads) {
        expect((options.body as FormData).get("expectedFileName")).toBe(
          "3PComms_01.XLSX",
        );
        expect((options.body as FormData).get("replace")).toBe("false");
      }
      expect(container.querySelector('[role="alert"]')).toBeNull();
    });

    it("rejects duplicate normalized originals before creating a batch", async () => {
      await act(async () =>
        root.render(
          <MappedUploadWorkspace
            workspace={workspace}
            pipelineCode="memo_sst"
            history="batches"
          />,
        ),
      );
      const input = container.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", {
        value: [
          new File(["one"], "3PComms_10272026.xlsx"),
          new File(["two"], "3pcomms_10272026.XLSX.xlsx"),
        ],
      });
      await act(async () =>
        input.dispatchEvent(new Event("change", { bubbles: true })),
      );
      expect(container.textContent).toContain("Duplicate files");
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
    expect(container.querySelector("ul")?.textContent).toBe("3PComms_");
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
    expect(container.querySelector("ul")?.textContent).toBe("3PComms_");
    await act(async () =>
      resolveGuidelines({
        requirements: [{ id: 999, fileName: "obsolete.xlsx" }],
      }),
    );
    expect(container.textContent).not.toContain("obsolete.xlsx");
    expect(container.querySelector("ul")?.textContent).toBe("3PComms_");
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

    expect(container.querySelector("ul")?.textContent).toBe("3PComms_");
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
          return {
            batch: { id: "new-batch" },
            files: JSON.parse(options.body as string).files.map(
              (file: { originalName: string; expectedFileName: string }) => ({
                ...file,
                savedFileName: file.expectedFileName,
              }),
            ),
          };
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
    expect(replacements).toEqual(["false", "false"]);
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
      expect(statusRow.querySelectorAll("td").length).toBe(4);
      expect(
        Array.from(container.querySelectorAll("th")).map(
          (cell) => cell.textContent,
        ),
      ).toEqual([
        history === "batches" ? "Batch Number" : "File Name",
        "Uploaded By",
        "Upload",
        "Actions",
      ]);
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
            ? {
                batch: { id: "new-batch" },
                files: JSON.parse(options.body as string).files.map(
                  (file: {
                    originalName: string;
                    expectedFileName: string;
                  }) => ({ ...file, savedFileName: file.expectedFileName }),
                ),
              }
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
