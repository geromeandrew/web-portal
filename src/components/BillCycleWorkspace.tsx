import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileText,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../lib/apiClient";
import type {
  ProcessingPipelineCatalogDto,
  ProcessingPipelineFileDto,
  ProcessingPipelineFileListDto,
} from "../lib/apiTypes";
import {
  formatBillCycleUploadTimestamp,
  groupFilesByBillCycle,
  sortBillCyclesAscending,
  validateBillCycleUpload,
} from "../lib/billCycleWorkspace";
import {
  resolveWorkspacePipelineCode,
  type WorkspaceDefinition,
} from "../lib/workspaces";
import fileGuidelinesIcon from "../assets/file-guidelines-icon.svg";
import workspaceBackgroundIllustration from "../assets/workspace-background-illustration.png";
import uploadFilesIcon from "../assets/upload-files-icon.svg";
import { validateFileSize } from "../lib/uploadClient";
import ActivityFileRow from "./ActivityFileRow";
import { ActivityColumns, UploadStatus } from "./UploadStatus";
import { workspaceUi } from "./WorkspaceShell";
import ActivityTableHead from "./ActivityTableHead";
import { WorkspaceLoading } from "./WorkspaceLoading";
import { useWorkspaceGuidelines } from "../lib/useWorkspaceGuidelines";
import { EmptyActivityState } from "./EmptyActivityState";

type UploadQueueEntry = { fileName: string; complete: boolean };
type UploadProgress = {
  completed: number;
  total: number;
  error: string | null;
  complete: boolean;
  entries: UploadQueueEntry[];
} | null;

function WorkspaceBackgroundIllustration() {
  return (
    <img
      src={workspaceBackgroundIllustration}
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-0 hidden w-[31rem] object-contain opacity-60 lg:block"
    />
  );
}

function UploadQueue({
  entries,
  onCancel,
}: {
  entries: readonly UploadQueueEntry[];
  onCancel(): void;
}) {
  return (
    <section aria-label="Upload progress" className="space-y-1.5">
      {entries.map((entry) => (
        <div
          key={entry.fileName}
          className="grid min-h-[48px] grid-cols-[minmax(0,1fr)_132px_auto] items-center gap-4 rounded-[5px] bg-white px-5 shadow-[0_1px_4px_rgba(20,47,89,0.07)] ring-1 ring-[#e0e8f2] 2xl:min-h-[58px] 2xl:px-6"
        >
          <div className="flex min-w-0 items-center gap-2 font-elliot text-[11px] text-[#1f2937] 2xl:text-[13px]">
            <FileText className="h-3.5 w-3.5 shrink-0 text-[#16b36f]" />
            <span className="truncate">{entry.fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#edf0f3]">
              <div
                className="h-full rounded-full bg-[#1399eb] transition-[width] duration-200"
                style={{ width: entry.complete ? "100%" : "25%" }}
              />
            </div>
            <span className="w-7 font-elliot text-[11px] text-[#89919d]">
              {entry.complete ? "100%" : "25%"}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring font-elliot text-[11px] text-[#087dca] underline underline-offset-2 2xl:text-[13px]"
          >
            Cancel
          </button>
        </div>
      ))}
    </section>
  );
}

export default function BillCycleWorkspace({
  workspace,
  pipelineCode: initialPipelineCode,
}: {
  workspace: WorkspaceDefinition;
  pipelineCode?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [pipelineCode, setPipelineCode] = useState<string | null>(
    initialPipelineCode ?? null,
  );
  const { guidelines, loadingGuidelines, acceptInventory } =
    useWorkspaceGuidelines(pipelineCode);
  const [files, setFiles] = useState<ProcessingPipelineFileDto[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState("");
  const [filterCycle, setFilterCycle] = useState("all");
  const [dragging, setDragging] = useState(false);
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(
    () => new Set(),
  );
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(null);
  const [removingKeys, setRemovingKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [removalRequest, setRemovalRequest] = useState<{
    files: readonly ProcessingPipelineFileDto[];
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!uploadProgress?.complete) return;
    const timer = window.setTimeout(() => setUploadProgress(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [uploadProgress?.complete]);

  const loadFiles = useCallback(
    async (code: string, signal?: AbortSignal) => {
      setLoading(true);
      try {
        const result = await apiRequest<ProcessingPipelineFileListDto>(
          `/processing-pipelines/${encodeURIComponent(code)}/files`,
          { signal },
        );
        if (signal?.aborted) return;
        setFiles(result.files);
        acceptInventory(code, result.files);
        setConfigured(result.configured);
        setNotice(null);
      } catch (error) {
        if (signal?.aborted) return;
        setFiles([]);
        setNotice(
          error instanceof Error
            ? error.message
            : "Workspace files could not be loaded.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [acceptInventory],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    if (initialPipelineCode) {
      setPipelineCode(initialPipelineCode);
      void loadFiles(initialPipelineCode, controller.signal);
      return () => controller.abort();
    }
    void apiRequest<ProcessingPipelineCatalogDto>("/processing-pipelines", {
      signal: controller.signal,
    })
      .then((catalog) => {
        const resolvedCode = resolveWorkspacePipelineCode(
          workspace.id,
          catalog.pipelines,
        );
        if (!resolvedCode)
          throw new Error(
            "This workspace is not available in the current pipeline catalog.",
          );
        if (!active) return;
        setPipelineCode(resolvedCode);
        void loadFiles(resolvedCode, controller.signal);
      })
      .catch((error) => {
        if (!active) return;
        setLoading(false);
        setNotice(
          error instanceof Error
            ? error.message
            : "Workspace configuration could not be loaded.",
        );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [loadFiles, workspace.id, initialPipelineCode]);

  const cycles = useMemo(() => groupFilesByBillCycle(files), [files]);
  const cyclesAscending = useMemo(
    () => sortBillCyclesAscending(groupFilesByBillCycle(guidelines)),
    [guidelines],
  );
  const selectedGuidanceGroup = cyclesAscending.find(
    (group) => group.cycle === selectedCycle,
  );
  const selectedGroup = cycles.find((group) => group.cycle === selectedCycle);
  const visibleCycles =
    filterCycle === "all"
      ? cycles
      : cycles.filter((group) => group.cycle === filterCycle);
  const removalInProgress = Boolean(
    removalRequest?.files.some(
      (file) => file.key && removingKeys.has(file.key),
    ),
  );

  const uploadFiles = async (selected: FileList | File[]) => {
    if (
      !pipelineCode ||
      loading ||
      !selectedCycle ||
      !selectedGroup ||
      uploadAbortRef.current
    )
      return;
    if (!selected.length) return;
    setNotice(null);
    const sizeError = Array.from(selected)
      .map((file) => validateFileSize(file))
      .find(Boolean);
    if (sizeError) {
      setNotice(sizeError);
      return;
    }
    const validation = validateBillCycleUpload(
      selectedGroup.files,
      Array.from(selected),
    );
    if (!validation.valid) {
      setUploadProgress({
        completed: 0,
        total: 0,
        error: validation.message,
        complete: false,
        entries: [],
      });
      return;
    }

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const entries = validation.uploads.map((upload) => ({
      fileName: upload.file.name,
      complete: false,
    }));
    setUploadProgress({
      completed: 0,
      total: validation.uploads.length,
      error: null,
      complete: false,
      entries,
    });
    let completed = 0;
    let errorMessage: string | null = null;
    try {
      for (const upload of validation.uploads) {
        const body = new FormData();
        body.set("expectedFileName", upload.expected.expectedFileName);
        body.set(
          "replace",
          upload.expected.availability === "present" ? "true" : "false",
        );
        body.set("file", upload.file);
        await apiRequest(
          `/processing-pipelines/${encodeURIComponent(pipelineCode)}/files`,
          { method: "POST", body, signal: controller.signal },
        );
        completed += 1;
        setUploadProgress({
          completed,
          total: validation.uploads.length,
          error: null,
          complete: false,
          entries: entries.map((entry, index) => ({
            ...entry,
            complete: index < completed,
          })),
        });
      }
    } catch (error) {
      errorMessage = controller.signal.aborted
        ? "Upload cancelled."
        : error instanceof Error
          ? error.message
          : "A file could not be uploaded.";
    } finally {
      await loadFiles(pipelineCode);
      if (completed > 0) {
        setExpandedCycles(new Set([selectedCycle]));
      }
      setUploadProgress({
        completed,
        total: validation.uploads.length,
        error: errorMessage,
        complete: !errorMessage,
        entries: entries.map((entry, index) => ({
          ...entry,
          complete: index < completed,
        })),
      });
      uploadAbortRef.current = null;
    }
  };

  const cancelUpload = () => uploadAbortRef.current?.abort();

  const removeFiles = async () => {
    const targetFiles = removalRequest?.files ?? [];
    const label = removalRequest?.label ?? "selected files";
    if (!pipelineCode) return;
    const keys = targetFiles.flatMap((file) => (file.key ? [file.key] : []));
    if (!keys.length) return;
    setRemovingKeys((current) => new Set([...current, ...keys]));
    const results = await Promise.allSettled(
      keys.map((key) =>
        apiRequest(
          `/processing-pipelines/${encodeURIComponent(pipelineCode)}/files?${new URLSearchParams({ key })}`,
          { method: "DELETE" },
        ),
      ),
    );
    setRemovingKeys((current) => {
      const next = new Set(current);
      keys.forEach((key) => next.delete(key));
      return next;
    });
    await loadFiles(pipelineCode);
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length)
      setNotice(
        `${failures.length} file${failures.length === 1 ? " could" : "s could"} not be removed.`,
      );
    setRemovalRequest(null);
  };

  return (
    <div className={workspaceUi.page}>
      <WorkspaceBackgroundIllustration />
      <section
        className={workspaceUi.content}
        aria-labelledby="workspace-title"
      >
        <h1 id="workspace-title" className={workspaceUi.title}>
          {workspace.title}
        </h1>
        <p className={workspaceUi.description}>{workspace.description}</p>

        {uploadProgress?.complete ? (
          <div role="status" className={workspaceUi.successToast}>
            <CheckCircle2 className="h-4 w-4" />
            {uploadProgress.total} files successfully uploaded
          </div>
        ) : null}

        {notice ? (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2 rounded-[5px] border border-rose-200 bg-rose-50 px-4 py-3 font-elliot text-[13px] text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </div>
        ) : null}

        <div className={workspaceUi.grid}>
          <section
            aria-busy={loading}
            className={`${workspaceUi.panel} ${workspaceUi.uploadPanel}`}
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
                Select the bill cycle first. Files are checked by report
                identity; entity and cycle suffixes are normalized to the
                selected workspace and cycle when stored:
              </p>
              {(loading || loadingGuidelines) && !guidelines.length ? (
                <WorkspaceLoading label="Loading file guidelines..." compact />
              ) : (
                <ul className={workspaceUi.guidanceList}>
                  {selectedGuidanceGroup ? (
                    selectedGuidanceGroup.files.map((file) => (
                      <li key={file.id}>{file.expectedFileName}</li>
                    ))
                  ) : (
                    <li>Select a bill cycle to see its required files.</li>
                  )}
                </ul>
              )}
            </div>

            <label className="sr-only" htmlFor="bill-cycle-upload">
              Bill Cycle
            </label>
            <select
              id="bill-cycle-upload"
              value={selectedCycle}
              onChange={(event) => {
                setSelectedCycle(event.target.value);
                setUploadProgress(null);
              }}
              disabled={
                loadingGuidelines ||
                !cyclesAscending.length ||
                Boolean(uploadAbortRef.current)
              }
              className={workspaceUi.cycleSelect}
            >
              <option value="">
                {loading && !guidelines.length
                  ? "Loading bill cycles"
                  : "Bill Cycle"}
              </option>
              {cyclesAscending.map((group) => (
                <option key={group.cycle} value={group.cycle}>
                  Bill Cycle {group.cycle}
                </option>
              ))}
            </select>
            {selectedGuidanceGroup ? (
              <p className={workspaceUi.cycleMeta}>
                {selectedGuidanceGroup.files.length} required files for Bill
                Cycle {selectedGuidanceGroup.cycle}
              </p>
            ) : null}

            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              multiple
              onChange={(event) => {
                if (event.target.files) void uploadFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              disabled={
                loading ||
                !selectedGroup ||
                Boolean(
                  uploadProgress &&
                  !uploadProgress.complete &&
                  !uploadProgress.error,
                )
              }
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                if (selectedGroup) setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void uploadFiles(event.dataTransfer.files);
              }}
              className={`${workspaceUi.dropZone} ${dragging ? "border-[#087dca] bg-[#eef8ff]" : ""} disabled:cursor-not-allowed disabled:opacity-55`}
            >
              {loading ||
              (uploadProgress &&
                !uploadProgress.complete &&
                !uploadProgress.error) ? (
                <LoaderCircle className={workspaceUi.uploadSpinner} />
              ) : (
                <img
                  src={uploadFilesIcon}
                  alt=""
                  aria-hidden="true"
                  className={workspaceUi.uploadIcon}
                />
              )}
              <span className={workspaceUi.uploadLabel}>
                {loading
                  ? "Loading workspace files..."
                  : uploadProgress &&
                      !uploadProgress.complete &&
                      !uploadProgress.error
                    ? `Uploading ${uploadProgress.completed} of ${uploadProgress.total}`
                    : "Drop files here"}
              </span>
              <span className={workspaceUi.uploadHint}>
                {loading
                  ? "Preparing file upload"
                  : "or click to browse your computer"}
              </span>
            </button>
            {uploadProgress && !uploadProgress.complete ? (
              <p
                role="status"
                className={`mt-3 flex items-start gap-1.5 font-elliot text-[11px] leading-4 ${uploadProgress.error ? "text-rose-600" : "text-[#087dca]"}`}
              >
                {uploadProgress.error ? (
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <LoaderCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                )}
                {uploadProgress.error ??
                  `Uploading ${uploadProgress.completed} of ${uploadProgress.total} files.`}
              </p>
            ) : null}
          </section>

          <div className="flex min-w-0 flex-col gap-3">
            {uploadProgress &&
            !uploadProgress.complete &&
            !uploadProgress.error &&
            uploadProgress.entries.length ? (
              <UploadQueue
                entries={uploadProgress.entries}
                onCancel={cancelUpload}
              />
            ) : null}
            <section
              className={`${workspaceUi.panel} ${workspaceUi.activityPanel}`}
              aria-busy={loading}
              aria-labelledby="activity-history-heading"
            >
              <div className={workspaceUi.activityHeader}>
                <h2
                  id="activity-history-heading"
                  className={workspaceUi.panelHeading}
                >
                  ACTIVITY HISTORY
                </h2>
                <label className="flex items-center gap-2 font-elliot text-[10px] text-[#252d39]">
                  Filter
                  <select
                    value={filterCycle}
                    onChange={(event) => setFilterCycle(event.target.value)}
                    className={workspaceUi.activityFilter}
                  >
                    <option value="all">All Bill Cycle</option>
                    {cyclesAscending.map((group) => (
                      <option key={group.cycle} value={group.cycle}>
                        Bill Cycle {group.cycle}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={workspaceUi.activityBody}>
                {!loading && (!configured || !visibleCycles.length) ? (
                  <EmptyActivityState
                    message={
                      !configured
                        ? "No file mapping is configured for this workspace."
                        : filterCycle === "all"
                          ? undefined
                          : "No uploaded files match the selected bill cycle."
                    }
                  />
                ) : (
                  <table className={workspaceUi.table}>
                    <ActivityColumns />
                    <ActivityTableHead label="BATCH CYCLE" />
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-7 py-10 text-center">
                            <WorkspaceLoading label="Loading activity history..." />
                          </td>
                        </tr>
                      ) : !configured ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-7 py-10 text-center font-elliot text-[12px] text-slate-500"
                          >
                            No file mapping is configured for this workspace.
                          </td>
                        </tr>
                      ) : !visibleCycles.length ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-7 py-10 text-center font-elliot text-[12px] text-slate-500"
                          >
                            No bill-cycle activity is available.
                          </td>
                        </tr>
                      ) : (
                        visibleCycles.map((group) => (
                          <ActivityRow
                            key={group.cycle}
                            group={group}
                            expanded={expandedCycles.has(group.cycle)}
                            onToggle={() =>
                              setExpandedCycles((current) => {
                                const next = new Set(current);
                                next.has(group.cycle)
                                  ? next.delete(group.cycle)
                                  : next.add(group.cycle);
                                return next;
                              })
                            }
                            onRemove={(files, label) =>
                              setRemovalRequest({ files, label })
                            }
                            removingKeys={removingKeys}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
      {removalRequest ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm removing uploaded files"
          className="fixed inset-0 z-50 grid place-items-center bg-[#0e1522]/30 p-5"
        >
          <section className="w-full max-w-sm rounded-[8px] bg-white p-6 shadow-2xl">
            <h2 className="font-elliot text-[17px] font-bold text-[#171b24]">
              Remove uploaded file{removalRequest.files.length === 1 ? "" : "s"}
              ?
            </h2>
            <p className="mt-2 font-elliot text-[12px] leading-5 text-[#64748b]">
              This permanently removes{" "}
              {removalRequest.files.length === 1
                ? "the selected file"
                : `${removalRequest.files.length} files`}{" "}
              from {removalRequest.label}.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={removalInProgress}
                onClick={() => setRemovalRequest(null)}
                className="focus-ring rounded-[5px] px-4 py-2 font-elliot text-[12px] text-[#252d39] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removalInProgress}
                onClick={() => void removeFiles()}
                className="focus-ring inline-flex items-center gap-2 rounded-[5px] bg-[#d84a4a] px-4 py-2 font-elliot text-[12px] font-bold text-white hover:bg-[#bd3939] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {removalInProgress ? (
                  <>
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    Removing
                  </>
                ) : (
                  "Remove"
                )}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ActivityRow({
  group,
  expanded,
  onToggle,
  onRemove,
  removingKeys,
}: {
  group: ReturnType<typeof groupFilesByBillCycle>[number];
  expanded: boolean;
  onToggle: () => void;
  onRemove(files: readonly ProcessingPipelineFileDto[], label: string): void;
  removingKeys: Set<string>;
}) {
  const newest = [...group.files]
    .filter((file) => file.uploadedAt ?? file.lastModified)
    .sort(
      (left, right) =>
        Date.parse(right.uploadedAt ?? right.lastModified ?? "") -
        Date.parse(left.uploadedAt ?? left.lastModified ?? ""),
    )[0];
  const removableFiles = group.files.filter((file) => file.key);
  const removing = removableFiles.some(
    (file) => file.key && removingKeys.has(file.key),
  );
  return (
    <>
      <tr className="border-b border-[#dce3ed] bg-white">
        <td className={workspaceUi.tableGroupName}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className={workspaceUi.tableToggle}
          >
            <ChevronRight
              className={`h-4 w-4 text-[#1689df] transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            Bill Cycle {group.cycle}
          </button>
        </td>
        <td className={workspaceUi.tableUploader}>
          {newest?.uploadedBy ?? "-"}
        </td>
        <td className={workspaceUi.tableTimestamp}>
          {formatBillCycleUploadTimestamp(group.latestUploadAt)}
        </td>
        <td className={workspaceUi.tableValue}>-</td>
        <td className={workspaceUi.tableValue}>-</td>
        <td className={workspaceUi.tableActions}>
          <button
            type="button"
            disabled={!removableFiles.length || removing}
            onClick={() =>
              onRemove(removableFiles, `Bill Cycle ${group.cycle}`)
            }
            aria-label={`Remove Bill Cycle ${group.cycle}`}
            className="focus-ring grid h-6 w-6 place-items-center rounded text-[#1689df] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {removing ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </td>
      </tr>
      {expanded ? (
        <CycleFileDetails
          files={group.files}
          onRemove={onRemove}
          removingKeys={removingKeys}
        />
      ) : null}
    </>
  );
}

function CycleFileDetails({
  files,
  onRemove,
  removingKeys,
}: {
  files: readonly ProcessingPipelineFileDto[];
  onRemove(files: readonly ProcessingPipelineFileDto[], label: string): void;
  removingKeys: Set<string>;
}) {
  return (
    <>
      {files.map((file, index) => (
        <ActivityFileRow
          key={file.id}
          first={index === 0}
          last={index === files.length - 1}
          fileName={file.matchedFileName ?? file.expectedFileName}
          status={
            <UploadStatus
              present={file.availability === "present"}
              readAt={file.uploadedAt ?? file.lastModified}
            />
          }
          action={
            <button
              type="button"
              disabled={!file.key || removingKeys.has(file.key)}
              onClick={() =>
                onRemove([file], file.matchedFileName ?? file.expectedFileName)
              }
              aria-label={`Remove ${file.expectedFileName}`}
              className="focus-ring grid h-6 w-6 place-items-center rounded text-[#1689df] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {file.key && removingKeys.has(file.key) ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          }
        />
      ))}
    </>
  );
}
