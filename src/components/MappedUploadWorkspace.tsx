import {
  AlertCircle,
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
import { validateFileSize } from "../lib/uploadClient";
import { matchesMemoUpload, memoUploadIdentity } from "../lib/memoUpload";
import sheetsIcon from "../assets/sheets-icon.svg";
import ActivityFileRow from "./ActivityFileRow";
import ActivityTableHead from "./ActivityTableHead";
import { WorkspaceLoading } from "./WorkspaceLoading";
import { useWorkspaceGuidelines } from "../lib/useWorkspaceGuidelines";
import { ActivityColumns, UploadStatus } from "./UploadStatus";
import { formatBillCycleUploadTimestamp } from "../lib/billCycleWorkspace";
import { EmptyActivityState } from "./EmptyActivityState";
import WorkspaceShell, { workspaceUi } from "./WorkspaceShell";

type Props = {
  workspace: WorkspaceDefinition;
  history: "flat" | "batches";
  pipelineCode?: string;
};
type FlatRow = {
  expectedFileName: string;
  originalName: string;
  readAt: string;
  removedAt?: string | null;
  objectKey: string;
  batch: ProcessingPipelineUploadBatchDto;
};

const batchLabel = (value: string) =>
  `Batch_${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)).replaceAll("/", "")}`;

function matches(
  file: File,
  requirement: ProcessingPipelineFileDto,
  pipelineCode?: string,
) {
  const name = file.name.toLowerCase();
  const expected = requirement.expectedFileName.toLowerCase();
  if (
    pipelineCode === "aprm_voice_accrual" &&
    expected === "aur extract final_billing.xlsx"
  )
    return name.includes("aur") && name.endsWith(".xlsx");
  if (requirement.match !== "glob") {
    // Windows can hide the existing extension when a user renames a workbook.
    // Accept repeated Excel extensions only when the full mapped stem matches.
    return (
      name === expected || name.replace(/(?:\.xlsx){2,}$/, ".xlsx") === expected
    );
  }
  const pattern = `^${expected
    .split("*")
    .map((part) =>
      part
        .split("?")
        .map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("."),
    )
    .join(".*")}$`;
  return new RegExp(pattern, "i").test(file.name);
}

export default function MappedUploadWorkspace({
  workspace,
  history,
  pipelineCode: initialPipelineCode,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadInProgress = useRef(false);
  const removalInProgress = useRef(false);
  const [removalRequest, setRemovalRequest] = useState<
    ProcessingPipelineUploadBatchDto["files"][number] | null
  >(null);
  const [removing, setRemoving] = useState(false);
  const [pipelineCode, setPipelineCode] = useState<string | null>(
    initialPipelineCode ?? null,
  );
  const { guidelines, loadingGuidelines, acceptInventory } =
    useWorkspaceGuidelines(pipelineCode);
  const guidelineItems = useMemo(() => {
    const seen = new Set<string>();
    return guidelines.flatMap((file) => {
      const name =
        pipelineCode === "memo_sst"
          ? file.expectedFileName.replace(/_[^_]+\.xlsx$/i, "_")
          : file.expectedFileName;
      const identity = name.toLowerCase();
      if (pipelineCode === "memo_sst" && seen.has(identity)) return [];
      seen.add(identity);
      return [{ id: file.id, name }];
    });
  }, [guidelines, pipelineCode]);
  const loadVersion = useRef(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [files, setFiles] = useState<ProcessingPipelineFileDto[]>([]);
  const [batches, setBatches] = useState<ProcessingPipelineUploadBatchDto[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const load = useCallback(
    async (code: string, signal?: AbortSignal, uploadedBatchId?: string) => {
      const version = ++loadVersion.current;
      const current = () => !signal?.aborted && version === loadVersion.current;
      setLoading(true);
      setHistoryLoading(true);
      // Neither history nor guidelines depend on the S3 inventory completing.
      const [fileResult, historyResult] = await Promise.allSettled([
        apiRequest<ProcessingPipelineFileListDto>(
          `/processing-pipelines/${encodeURIComponent(code)}/files`,
          { signal },
        )
          .then((result) => {
            if (current()) {
              setFiles(result.files);
              acceptInventory(code, result.files);
            }
          })
          .finally(() => {
            if (current()) setLoading(false);
          }),
        apiRequest<{ batches: ProcessingPipelineUploadBatchDto[] }>(
          `/processing-pipelines/${encodeURIComponent(code)}/upload-batches`,
          { signal },
        )
          .then((result) => {
            if (current()) {
              setBatches(result.batches);
              if (
                uploadedBatchId &&
                ["memo_sst", "aprm_voice_accrual"].includes(code) &&
                result.batches.some((batch) => batch.id === uploadedBatchId)
              ) {
                setExpanded(new Set([result.batches[0].id]));
              }
            }
          })
          .finally(() => {
            if (current()) setHistoryLoading(false);
          }),
      ]);
      if (!current()) return;
      if (fileResult.status === "rejected") throw fileResult.reason;
      if (historyResult.status === "rejected") {
        setBatches([]);
        setNotice(
          historyResult.reason instanceof Error
            ? `File mappings loaded, but upload activity could not be loaded: ${historyResult.reason.message}`
            : "File mappings loaded, but upload activity could not be loaded.",
        );
      } else setNotice(null);
    },
    [acceptInventory],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (initialPipelineCode) {
      setPipelineCode(initialPipelineCode);
      void load(initialPipelineCode, controller.signal).catch((error) => {
        if (!controller.signal.aborted)
          setNotice(
            error instanceof Error
              ? error.message
              : "Workspace files could not be loaded.",
          );
      });
      return () => controller.abort();
    }
    void apiRequest<ProcessingPipelineCatalogDto>("/processing-pipelines", {
      signal: controller.signal,
    })
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
            setHistoryLoading(false);
            setNotice(null);
          }
          return;
        }
        if (!active) return;
        setPipelineCode(code);
        await load(code, controller.signal);
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
          setHistoryLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [load, workspace.id, initialPipelineCode]);

  const upload = async (selected: FileList | File[]) => {
    if (
      !pipelineCode ||
      loading ||
      uploadInProgress.current ||
      removalInProgress.current
    )
      return;
    const chosen = Array.from(selected);
    if (!chosen.length) return;
    const sizeError = chosen
      .map((file) => validateFileSize(file))
      .find(Boolean);
    if (sizeError) {
      setNotice(sizeError);
      return;
    }
    const assignments = chosen.map((file) => ({
      file,
      expected: files.find((item) =>
        pipelineCode === "memo_sst"
          ? matchesMemoUpload(item.expectedFileName, file.name)
          : matches(file, item, pipelineCode),
      ),
    }));
    const invalid = assignments.find((item) => !item.expected);
    if (invalid) {
      setNotice(
        `${invalid.file.name} is not required by the current file mapping.`,
      );
      return;
    }
    if (
      new Set(
        assignments.map(({ file, expected }) =>
          (pipelineCode === "memo_sst"
            ? JSON.stringify(memoUploadIdentity(file.name))
            : expected!.match === "glob"
              ? file.name
              : expected!.expectedFileName
          ).toLowerCase(),
        ),
      ).size !== chosen.length
    ) {
      setNotice("Duplicate files cannot be uploaded in the same batch.");
      return;
    }
    uploadInProgress.current = true;
    let uploadError: string | null = null;
    let uploadedBatchId: string | undefined;
    try {
      setNotice(null);
      setUploading(chosen.map((file) => file.name));
      const created = await apiRequest<{
        batch: { id: string };
        files?: {
          originalName: string;
          expectedFileName: string;
          savedFileName: string;
        }[];
      }>(
        `/processing-pipelines/${encodeURIComponent(pipelineCode)}/upload-batches`,
        {
          method: "POST",
          ...(pipelineCode === "memo_sst"
            ? {
                body: JSON.stringify({
                  files: assignments.map(({ file, expected }) => ({
                    originalName: file.name,
                    expectedFileName: expected!.expectedFileName,
                  })),
                }),
              }
            : {}),
        },
      );
      uploadedBatchId = created.batch.id;
      if (pipelineCode === "memo_sst" && !created.files?.length)
        throw new Error(
          "The Memo upload plan could not be loaded. Please try again.",
        );
      const planned =
        pipelineCode === "memo_sst"
          ? created.files!.map((entry) => ({
              ...assignments.find(
                ({ file }) => file.name === entry.originalName,
              )!,
              savedFileName: entry.savedFileName,
            }))
          : assignments.map((entry) => ({
              ...entry,
              savedFileName: entry.expected!.expectedFileName,
            }));
      for (const { file, expected } of planned) {
        const body = new FormData();
        body.set("file", file);
        body.set("expectedFileName", expected!.expectedFileName);
        body.set(
          "replace",
          pipelineCode !== "memo_sst" && expected!.availability === "present"
            ? "true"
            : "false",
        );
        body.set("batchId", created.batch.id);
        await apiRequest(
          `/processing-pipelines/${encodeURIComponent(pipelineCode)}/files`,
          { method: "POST", body },
        );
        // Keep the operation locked until all files and activity are refreshed.
      }
    } catch (error) {
      uploadError =
        error instanceof Error
          ? error.message
          : "A file could not be uploaded.";
    } finally {
      // A failed batch can still have successful files. Refresh those before retrying.
      try {
        await load(pipelineCode, undefined, uploadedBatchId);
      } catch (error) {
        uploadError ??=
          error instanceof Error
            ? error.message
            : "Workspace files could not be loaded.";
      }
      if (uploadError) setNotice(uploadError);
      uploadInProgress.current = false;
      setUploading([]);
    }
  };

  const removeFile = async () => {
    if (
      !pipelineCode ||
      !removalRequest ||
      removalInProgress.current ||
      uploadInProgress.current
    )
      return;
    removalInProgress.current = true;
    setRemoving(true);
    let removed = false;
    try {
      await apiRequest(
        `/processing-pipelines/${encodeURIComponent(pipelineCode)}/files?${new URLSearchParams({ key: removalRequest.objectKey })}`,
        { method: "DELETE" },
      );
      removed = true;
      // Immediately disable all history entries for the deleted current object.
      setBatches((current) =>
        current.map((batch) => ({
          ...batch,
          files: batch.files.map((file) =>
            file.objectKey === removalRequest.objectKey
              ? { ...file, removedAt: new Date().toISOString() }
              : file,
          ),
        })),
      );
      setRemovalRequest(null);
      await load(pipelineCode);
    } catch (error) {
      setNotice(
        `${removed ? "File removed, but activity could not be refreshed: " : ""}${error instanceof Error ? error.message : "The file could not be removed."}`,
      );
    } finally {
      removalInProgress.current = false;
      setRemoving(false);
    }
  };

  const flatRows = useMemo(
    () =>
      batches.flatMap((batch) =>
        batch.files.map((file) => ({ ...file, batch })),
      ),
    [batches],
  );
  const disabled =
    !pipelineCode ||
    loading ||
    !files.length ||
    Boolean(uploading.length) ||
    removing;
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
          aria-busy={loading}
          aria-labelledby="file-upload-heading"
        >
          <h2 id="file-upload-heading" className={workspaceUi.panelHeading}>
            FILE UPLOAD
          </h2>
          <div className={workspaceUi.guidance}>
            <div className={workspaceUi.guidanceTitle}>
              <img
                src={fileGuidelinesIcon}
                alt=""
                className={workspaceUi.guidanceIcon}
              />
              File Guidelines
            </div>
            <p className={workspaceUi.guidanceText}>
              All files must follow the correct file name convention:
            </p>
            <ul className={workspaceUi.guidanceList}>
              {guidelineItems.length ? (
                guidelineItems.map((file) => <li key={file.id}>{file.name}</li>)
              ) : loading || loadingGuidelines ? (
                <li className="list-none">
                  <WorkspaceLoading
                    label="Loading file guidelines..."
                    compact
                  />
                </li>
              ) : (
                <li>No mapped files are configured.</li>
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
              {uploading.length || loading ? (
                <LoaderCircle className={workspaceUi.uploadSpinner} />
              ) : (
                <img
                  src={uploadFilesIcon}
                  alt=""
                  aria-hidden="true"
                  className={workspaceUi.uploadIcon}
                />
              )}
            </>
            <span className={workspaceUi.uploadLabel}>
              {loading
                ? "Loading workspace files..."
                : uploading.length
                  ? `Uploading ${uploading.length} file${uploading.length === 1 ? "" : "s"}`
                  : "Drop files here"}
            </span>
            <span className={workspaceUi.uploadHint}>
              {loading
                ? "Preparing file upload"
                : "or click to browse your computer"}
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
            aria-busy={historyLoading}
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
            {historyLoading ? (
              <WorkspaceLoading label="Loading activity history..." />
            ) : history === "flat" ? (
              flatRows.length ? (
                <FlatHistory
                  rows={flatRows}
                  onRemove={setRemovalRequest}
                  busy={loading || removing || Boolean(uploading.length)}
                />
              ) : (
                <EmptyActivityState />
              )
            ) : batches.length ? (
              <BatchHistory
                onRemove={setRemovalRequest}
                busy={loading || removing || Boolean(uploading.length)}
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
      {removalRequest ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm removing uploaded files"
          className="fixed inset-0 z-50 grid place-items-center bg-[#0e1522]/30 p-5"
        >
          <section className="w-full max-w-sm rounded-[8px] bg-white p-6 shadow-2xl">
            <h2 className="font-elliot text-[17px] font-bold">
              Remove uploaded file?
            </h2>
            <p className="mt-2 break-words text-[12px] leading-5 text-slate-500">
              This permanently removes {removalRequest.originalName} from this
              workspace.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => setRemovalRequest(null)}
                className="focus-ring rounded px-4 py-2 text-[12px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => void removeFile()}
                className="focus-ring rounded bg-[#d84a4a] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
              >
                {removing ? "Removing" : "Remove"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}

type HistoryFile = ProcessingPipelineUploadBatchDto["files"][number];
type HistoryActions = { onRemove(file: HistoryFile): void; busy: boolean };

function RemoveFileButton({
  file,
  onRemove,
  busy,
}: HistoryActions & { file: HistoryFile }) {
  return (
    <button
      type="button"
      disabled={busy || Boolean(file.removedAt)}
      aria-label={`Remove ${file.originalName}`}
      onClick={() => onRemove(file)}
      className="focus-ring grid h-6 w-6 place-items-center rounded text-[#1689df] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function FlatHistory({
  rows,
  ...actions
}: HistoryActions & { rows: FlatRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className={workspaceUi.table}>
        <ActivityColumns />
        <ActivityTableHead label="File Name" />
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.batch.id}-${row.expectedFileName}-${index}`}
              className="border-b border-[#dce3ed] bg-white"
            >
              <td className={`${workspaceUi.tableCell} break-words px-7 py-3`}>
                <span className="flex items-center gap-2">
                  <img src={sheetsIcon} alt="" className="h-3.5 shrink-0" />
                  {row.originalName}
                </span>
              </td>
              <td className={workspaceUi.tableUploader}>
                {row.batch.uploadedBy ?? "-"}
              </td>
              <td className={workspaceUi.tableValue}>
                {row.removedAt ? (
                  "Removed"
                ) : (
                  <UploadStatus readAt={row.readAt} />
                )}
              </td>
              <td className={workspaceUi.tablePlaceholder}>-</td>
              <td className={workspaceUi.tablePlaceholder}>-</td>
              <td className={workspaceUi.tableActions}>
                <RemoveFileButton file={row} {...actions} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchHistory({
  batches,
  expanded,
  onToggle,
  ...actions
}: HistoryActions & {
  batches: ProcessingPipelineUploadBatchDto[];
  expanded: Set<string>;
  onToggle(id: string): void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={workspaceUi.table}>
        <ActivityColumns />
        <ActivityTableHead label="Batch Number" />
        <tbody>
          {batches.map((batch) => (
            <FragmentBatch
              key={batch.id}
              batch={batch}
              expanded={expanded.has(batch.id)}
              onToggle={() => onToggle(batch.id)}
              {...actions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentBatch({
  batch,
  expanded,
  onToggle,
  ...actions
}: HistoryActions & {
  batch: ProcessingPipelineUploadBatchDto;
  expanded: boolean;
  onToggle(): void;
}) {
  return (
    <>
      <tr className="border-b border-[#dce3ed] bg-white">
        <td className={workspaceUi.tableGroupName}>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
            className={workspaceUi.tableToggle}
          >
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-[#1689df] ${expanded ? "rotate-90" : ""}`}
            />
            {batchLabel(batch.createdAt)}
          </button>
        </td>
        <td className={workspaceUi.tableUploader}>{batch.uploadedBy ?? "-"}</td>
        <td className={workspaceUi.tableTimestamp}>
          {formatBillCycleUploadTimestamp(batch.createdAt)}
        </td>
        <td className={workspaceUi.tablePlaceholder}>-</td>
        <td className={workspaceUi.tablePlaceholder}>-</td>
        <td className={workspaceUi.tableActions} />
      </tr>
      {expanded
        ? batch.files.map((file, index) => (
            <ActivityFileRow
              key={file.objectKey}
              first={index === 0}
              last={index === batch.files.length - 1}
              fileName={file.originalName}
              status={
                file.removedAt ? (
                  "Removed"
                ) : (
                  <UploadStatus readAt={file.readAt} />
                )
              }
              action={<RemoveFileButton file={file} {...actions} />}
            />
          ))
        : null}
    </>
  );
}
