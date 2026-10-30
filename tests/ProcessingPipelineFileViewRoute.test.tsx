import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import ProcessingPipelineFileViewRoute from "../src/routes/ProcessingPipelineFileViewRoute";
import { fetchApiFile } from "../src/lib/apiClient";

vi.mock("../src/lib/apiClient", () => ({ fetchApiFile: vi.fn() }));
const BrowserURL = URL;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "URL",
    class extends BrowserURL {
      static createObjectURL = vi.fn(() => "blob:security-review-file");
      static revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([
  ["text/plain", true],
  ["text/csv; charset=utf-8", true],
  ["TEXT/PLAIN; charset=UTF-8", true],
  ["application/pdf", true],
  ["image/png", true],
  ["image/jpeg", true],
  ["image/gif", true],
  ["image/webp", true],
  ["image/avif", true],
  ["image/bmp", true],
  ["text/html", false],
  ["image/svg+xml", false],
  ["text/xml", false],
  ["text/javascript", false],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", false],
  ["application/octet-stream", false],
])(
  "keeps supported previews and downloads while handling %s safely",
  async (contentType, preview) => {
    const blob = new Blob(["file content"], { type: contentType });
    vi.mocked(fetchApiFile).mockResolvedValue({ blob, contentType });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <MemoryRouter
            initialEntries={[
              "/processing-pipelines/files/view?pipelineCode=memo_sst&key=memo_sst%2Finbound%2Fsource.xlsx",
            ]}
          >
            <ProcessingPipelineFileViewRoute />
          </MemoryRouter>,
        ),
      );
      expect(fetchApiFile).toHaveBeenCalledWith(
        "/processing-pipelines/memo_sst/files/content?key=memo_sst%2Finbound%2Fsource.xlsx",
      );
      const frame = container.querySelector("iframe");
      expect(Boolean(frame)).toBe(preview);
      if (preview) {
        expect(frame?.getAttribute("src")).toBe("blob:security-review-file");
      } else {
        const download = container.querySelector("a[download]");
        expect(download?.getAttribute("href")).toBe(
          "blob:security-review-file",
        );
        expect(download?.getAttribute("download")).toBe("source.xlsx");
        expect(container.textContent).toContain(
          "Preview is not available for this file type.",
        );
      }
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:security-review-file",
    );
  },
);
