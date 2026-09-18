import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileText,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ProcessingPipelineCatalogDto,
  ProcessingPipelineFileDto,
  ProcessingPipelineFileListDto,
  ProcessingPipelineUploadBatchDto,
} from "../lib/apiTypes";
import { apiRequest } from "../lib/apiClient";
import {
  resolveWorkspacePipelineCode,
  type WorkspaceDefinition,
} from "../lib/workspaces";
import fileGuidelinesIcon from "../assets/file-guidelines-icon.svg";
import uploadFilesIcon from "../assets/upload-files-icon.svg";
import sheetsIcon from "../assets/sheets-icon.svg";
import { EmptyActivityState } from "./EmptyActivityState";
import WorkspaceShell, { workspaceUi } from "./WorkspaceShell";

type Props = { workspace: WorkspaceDefinition; history: "flat" | "batches" };
type FlatRow = {
  expectedFileName: string;
  originalName: string;
  readAt: string;
  batch: ProcessingPipelineUploadBatchDto;
};

const date = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "—";
const batchLabel = (value: string) =>
  `Batch_${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)).replaceAll("/", "")}`;

function matches(file: File, requirement: ProcessingPipelineFileDto) {
  const name = file.name.toLowerCase();
  const expected = requirement.expectedFileName.toLowerCase();
  if (requirement.match !== "glob") return name === expected;
  const pattern = `^${expected
    .replace(/[.+^${}()|[\\]\\]/g, "\\$&")
    .replaceAll("*", ".*")
    .replaceAll("?", ".")}$`;
  return new RegExp(pattern, "i").test(file.name);
}

export default function MappedUploadWorkspace({ workspace, history }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pipelineCode, setPipelineCode] = useState<string | null>(null);
  const [files, setFiles] = useState<ProcessingPipelineFileDto[]>([]);
  const [batches, setBatches] = useState<ProcessingPipelineUploadBatchDto[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const load = useCallback(async (code: string) => {
    const fileData = await apiRequest<ProcessingPipelineFileListDto>(
      `/processing-pipelines/${encodeURIComponent(code)}/files`,
    );
    setFiles(fileData.files);
    try {
      const batchData = await apiRequest<{
        batches: ProcessingPipelineUploadBatchDto[];
      }>(`/processing-pipelines/${encodeURIComponent(code)}/upload-batches`);
      setBatches(batchData.batches);
      setNotice(null);
    } catch (error) {
      setBatches([]);
      setNotice(
        error instanceof Error
          ? `File mappings loaded, but upload activity could not be loaded: ${error.message}`
          : "File mappings loaded, but upload activity could not be loaded.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    void apiRequest<ProcessingPipelineCatalogDto>("/processing-pipelines")
      .then(async (catalog) => {
        const code = resolveWorkspacePipelineCode(
          workspace.id,
          catalog.pipelines,
        );
        if (!code) {
          if (active) {
            setPipelineCode(null);
            setFiles([]);
            setLoading(false);
            setNotice(null);
          }
          return;
        }
        if (!active) return;
        setPipelineCode(code);
        await load(code);
        if (active) setLoading(false);
      })
      .catch((error) => {
        if (active) {
          setNotice(
            error instanceof Error
              ? error.message
              : "Workspace configuration could not be loaded.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [load, workspace.id]);

  const upload = async (selected: FileList | File[]) => {
    if (!pipelineCode || uploading.length) return;
    const chosen = Array.from(selected);
    if (!chosen.length) return;
    const assignments = chosen.map((file) => ({
      file,
      expected: files.find((item) => matches(file, item)),
    }));
    const invalid = assignments.find((item) => !item.expected);
    if (invalid) {
      setNotice(
        `${invalid.file.name} is not required by the current file mapping.`,
      );
      return;
    }
    if (
      new Set(chosen.map((file) => file.name.toLowerCase())).size !==
      chosen.length
    ) {
      setNotice("Duplicate files cannot be uploaded in the same batch.");
      return;
    }
    try {
      setNotice(null);
      setUploading(chosen.map((file) => file.name));
      const created = await apiRequest<{ batch: { id: string } }>(
        `/processing-pipelines/${encodeURIComponent(pipelineCode)}/upload-batches`,
        { method: "POST" },
      );
      for (const { file, expected } of assignments) {
        const body = new FormData();
        body.set("file", file);
        body.set("expectedFileName", expected!.expectedFileName);
        body.set(
          "replace",
          expected!.availability === "present" ? "true" : "false",
        );
        body.set("batchId", created.batch.id);
        await apiRequest(
          `/processing-pipelines/${encodeURIComponent(pipelineCode)}/files`,
          { method: "POST", body },
        );
        setUploading((current) => current.filter((name) => name !== file.name));
      }
      await load(pipelineCode);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "A file could not be uploaded.",
      );
    } finally {
      setUploading([]);
    }
  };

  const flatRows = useMemo(
    () =>
      batches.flatMap((batch) =>
        batch.files.map((file) => ({ ...file, batch })),
      ),
    [batches],
  );
  const disabled = !pipelineCode || !files.length || Boolean(uploading.length);
  return (
    <WorkspaceShell
      title={workspace.title}
      description={workspace.description}
      titleId="mapped-workspace-title"
    >
      {notice ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-[5px] border border-rose-200 bg-rose-50 px-4 py-3 font-elliot text-[13px] text-rose-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </div>
      ) : null}
      <div className={workspaceUi.grid}>
        <section
          className={`${workspaceUi.panel} ${workspaceUi.uploadPanel}`}
          aria-labelledby="file-upload-heading"
        >
          <h2 id="file-upload-heading" className={workspaceUi.panelHeading}>
            FILE UPLOAD
          </h2>
          <div className={workspaceUi.guidance}>
            <div className="flex items-center gap-2 font-elliot text-[12px] font-bold text-[#171b24] 2xl:gap-3 2xl:text-[14px]">
              <img
                src={fileGuidelinesIcon}
                alt=""
                className="h-5 w-5 2xl:h-6 2xl:w-6"
              />
              File Guidelines
            </div>
            <p className="mt-3 font-elliot text-[11px] leading-4 text-[#2a3240] 2xl:mt-4 2xl:text-[13px] 2xl:leading-5">
              All files must follow the correct file name convention:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 font-elliot text-[11px] leading-4 text-[#2a3240] 2xl:mt-2 2xl:space-y-1 2xl:pl-5 2xl:text-[13px] 2xl:leading-5">
              {files.length ? (
                files.map((file) => (
                  <li key={file.id}>{file.expectedFileName}</li>
                ))
              ) : (
                <li>
                  {loading
                    ? "Loading file mappings."
                    : "No mapped files are configured."}
                </li>
              )}
            </ul>
          </div>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            multiple
            onChange={(event) => {
              if (event.target.files) void upload(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void upload(event.dataTransfer.files);
            }}
            className={`${workspaceUi.dropZone} ${dragging ? "border-[#087dca] bg-[#eef8ff]" : ""} disabled:cursor-not-allowed disabled:opacity-55`}
          >
            <>
              {uploading.length ? (
                <LoaderCircle className="h-10 w-10 animate-spin text-[#4788f7]" />
              ) : (
                <img
                  src={uploadFilesIcon}
                  alt=""
                  aria-hidden="true"
                  className="h-10 w-auto 2xl:h-14"
                />
              )}
            </>
            <span className="mt-3 font-elliot text-[11px] font-bold text-[#087dca] 2xl:mt-4 2xl:text-[13px]">
              {uploading.length
                ? `Uploading ${uploading.length} file${uploading.length === 1 ? "" : "s"}`
                : "Drop files here"}
            </span>
            <span className="font-elliot text-[11px] text-[#087dca] 2xl:text-[13px]">
              or click to browse your computer
            </span>
          </button>
        </section>
        <div className="min-w-0 space-y-3">
          {uploading.map((name) => (
            <div
              key={name}
              className="grid min-h-[48px] grid-cols-[minmax(0,1fr)_132px_auto] items-center gap-4 rounded-[5px] bg-white px-5 shadow-[0_1px_4px_rgba(20,47,89,0.07)] ring-1 ring-[#e0e8f2] 2xl:min-h-[58px] 2xl:px-6"
            >
              <div className="flex min-w-0 items-center gap-2 font-elliot text-[11px] 2xl:text-[13px]">
                <FileText className="h-3.5 w-3.5 text-[#16b36f]" />
                <span className="truncate">{name}</span>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full bg-[#edf0f3]">
                <div className="h-full w-1/4 rounded-full bg-[#1399eb]" />
              </div>
              <span className="font-elliot text-[11px] text-[#89919d]">
                25%
              </span>
            </div>
          ))}
          <section
            className={workspaceUi.panel}
            aria-labelledby="activity-history-heading"
          >
            <div className={workspaceUi.activityHeader}>
              <h2
                id="activity-history-heading"
                className={workspaceUi.panelHeading}
              >
                ACTIVITY HISTORY
              </h2>
            </div>
            {history === "flat" ? (
              flatRows.length ? (
                <FlatHistory rows={flatRows} />
              ) : (
                <EmptyActivityState />
              )
            ) : batches.length ? (
              <BatchHistory
                batches={batches}
                expanded={expanded}
                onToggle={(id) =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    next.has(id) ? next.delete(id) : next.add(id);
                    return next;
                  })
                }
              />
            ) : (
              <EmptyActivityState />
            )}
          </section>
        </div>
      </div>
    </WorkspaceShell>
  );
}

function FlatHistory({ rows }: { rows: FlatRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[650px] text-left">
        <thead className="bg-[#f1f5fd] font-elliot text-[10px] font-bold uppercase text-[#4165a8]">
          <tr>
            <th className="px-7 py-3">File Name</th>
            <th className="px-4 py-3">Uploaded By</th>
            <th className="px-4 py-3">Upload</th>
            <th className="px-4 py-3">Preload</th>
            <th className="px-4 py-3">Postload</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr
                key={`${row.batch.id}-${row.expectedFileName}-${index}`}
                className="border-b border-[#dce3ed]"
              >
                <td className="px-7 py-3 font-elliot text-[12px]">
                  <span className="inline-flex items-center gap-2">
                    <img src={sheetsIcon} alt="" className="h-3.5" />
                    {row.originalName}
                  </span>
                </td>
                <td className="px-4 py-3 font-elliot text-[12px]">
                  {row.batch.uploadedBy ?? "—"}
                </td>
                <td className="px-4 py-3 font-elliot text-[11px] text-[#17ad6b]">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                  Read{" "}
                  <small className="block text-[#4165a8]">
                    {date(row.readAt)}
                  </small>
                </td>
                <td className="px-4 py-3 font-elliot text-[12px] text-[#8b96a6]">
                  —
                </td>
                <td className="px-4 py-3 font-elliot text-[12px] text-[#8b96a6]">
                  —
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={5}
                className="px-7 py-10 text-center font-elliot text-[12px] text-slate-500"
              >
                No upload activity is available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BatchHistory({
  batches,
  expanded,
  onToggle,
}: {
  batches: ProcessingPipelineUploadBatchDto[];
  expanded: Set<string>;
  onToggle(id: string): void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[650px] text-left">
        <thead className="bg-[#f1f5fd] font-elliot text-[10px] font-bold uppercase text-[#4165a8]">
          <tr>
            <th className="px-7 py-3">Batch Number</th>
            <th className="px-4 py-3">Uploaded By</th>
            <th className="px-4 py-3">Upload</th>
            <th className="px-4 py-3">Preload</th>
            <th className="px-4 py-3">Postload</th>
          </tr>
        </thead>
        <tbody>
          {batches.length ? (
            batches.map((batch) => (
              <FragmentBatch
                key={batch.id}
                batch={batch}
                expanded={expanded.has(batch.id)}
                onToggle={() => onToggle(batch.id)}
              />
            ))
          ) : (
            <tr>
              <td
                colSpan={5}
                className="px-7 py-10 text-center font-elliot text-[12px] text-slate-500"
              >
                No batch activity is available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function FragmentBatch({
  batch,
  expanded,
  onToggle,
}: {
  batch: ProcessingPipelineUploadBatchDto;
  expanded: boolean;
  onToggle(): void;
}) {
  return (
    <>
      <tr className="border-b border-[#dce3ed]">
        <td className="px-7 py-3 font-elliot text-[12px] font-bold">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-3"
          >
            <ChevronRight
              className={`h-4 w-4 text-[#1689df] ${expanded ? "rotate-90" : ""}`}
            />
            {batchLabel(batch.createdAt)}
          </button>
        </td>
        <td className="px-4 py-3 font-elliot text-[12px]">
          {batch.uploadedBy ?? "—"}
        </td>
        <td className="px-4 py-3 font-elliot text-[12px]">
          {date(batch.createdAt)}
        </td>
        <td className="px-4 py-3 font-elliot text-[12px] text-[#8b96a6]">—</td>
        <td className="px-4 py-3 font-elliot text-[12px] text-[#8b96a6]">—</td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={5} className="px-7 py-3">
            <div className="overflow-hidden rounded-[5px] border border-[#dce3ed]">
              {batch.files.map((file) => (
                <div
                  key={file.expectedFileName}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center border-b border-[#e6ebf2] px-4 py-3 font-elliot text-[11px] last:border-0"
                >
                  <span className="flex items-center gap-2">
                    <img src={sheetsIcon} alt="" className="h-3.5" />
                    {file.originalName}
                  </span>
                  <span className="text-[#17ad6b]">
                    <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                    Read
                  </span>
                  <span className="text-[#8b96a6]">—</span>
                  <span className="text-[#8b96a6]">—</span>
                  <button
                    disabled
                    title="Removing pipeline files is not available through the current API."
                    className="text-[#1689df] opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
