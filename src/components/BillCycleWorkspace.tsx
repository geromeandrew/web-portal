import { AlertCircle, CheckCircle2, ChevronRight, CloudUpload, FileText, LoaderCircle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../lib/apiClient";
import type { ProcessingPipelineCatalogDto, ProcessingPipelineFileDto, ProcessingPipelineFileListDto } from "../lib/apiTypes";
import { formatBillCycleUploadDate, groupFilesByBillCycle, validateBillCycleUpload } from "../lib/billCycleWorkspace";
import { resolveWorkspacePipelineCode, type WorkspaceDefinition } from "../lib/workspaces";
import fileGuidelinesIcon from "../assets/file-guidelines-icon.svg";
import workspaceBackgroundIllustration from "../assets/workspace-background-illustration.png";

const workspaceUi = {
  page: "relative isolate -mx-5 -my-10 min-h-[calc(100vh-72px)] overflow-hidden bg-[#f2f7fe] px-5 py-11 sm:-mx-8 sm:-my-12 sm:px-8 sm:py-12 lg:-mx-0 lg:-my-14 lg:px-0 lg:py-8",
  content: "relative mx-auto w-full max-w-none",
  title: "font-elliot text-[26px] font-bold leading-8 tracking-[-0.025em] text-[#0e1522] 2xl:text-[30px] 2xl:leading-10",
  description: "mt-1 font-elliot text-[13px] leading-5 text-[#1c2431] 2xl:text-[15px] 2xl:leading-6",
  grid: "mt-12 grid items-start gap-2 xl:grid-cols-[412fr_806fr] 2xl:mt-14 2xl:gap-3",
  panel: "overflow-hidden rounded-[8px] bg-white shadow-[0_2px_8px_rgba(20,47,89,0.08)] ring-1 ring-[#e4eaf2]",
  panelHeading: "font-elliot text-[11px] font-bold text-[#171b24] 2xl:text-[13px]",
  uploadPanel: "min-h-[529px] p-5 2xl:min-h-[600px] 2xl:p-6",
  activityPanel: "flex flex-col",
  activityBody: "overflow-x-auto",
  guidance: "mt-4 rounded-[5px] bg-[#f6f9fd] px-4 py-4 2xl:mt-5 2xl:px-5 2xl:py-5",
  cycleSelect: "focus-ring mt-3 h-[35px] w-full rounded-[5px] border border-[#b8c1cf] bg-white px-3 font-elliot text-[12px] text-[#5c6675] 2xl:mt-4 2xl:h-[42px] 2xl:px-4 2xl:text-[14px]",
  dropZone: "focus-ring mt-3 flex min-h-[267px] w-full flex-col items-center justify-center rounded-[5px] border border-dashed border-[#79baff] bg-[#f8fcff] px-6 text-center transition-colors 2xl:mt-5 2xl:min-h-[323px]",
  cycleMeta: "mt-2 font-elliot text-[10px] font-semibold text-[#087dca] 2xl:text-[12px]",
  activityHeader: "flex min-h-[37px] items-center justify-between gap-3 bg-[#e8eef8] px-6 2xl:min-h-[46px] 2xl:px-7",
  activityFilter: "focus-ring h-[25px] rounded-[3px] border border-[#b8c1cf] bg-white px-2 font-elliot text-[10px] text-[#252d39] 2xl:h-[31px] 2xl:px-3 2xl:text-[12px]",
  tableHead: "bg-[#f1f5fd] font-elliot text-[10px] font-bold uppercase text-[#4165a8] 2xl:text-[12px]",
  tableCell: "font-elliot text-[12px] text-[#171b24] 2xl:text-[14px]",
  successToast: "absolute left-1/2 top-[66px] z-20 flex -translate-x-1/2 items-center gap-2 rounded-[5px] bg-[#1fac6c] px-4 py-3 font-elliot text-[12px] text-white shadow-[0_5px_12px_rgba(22,104,68,0.18)] xl:left-[48%] 2xl:top-[82px] 2xl:px-5 2xl:py-4 2xl:text-[14px]",
};

type UploadQueueEntry = { fileName: string; complete: boolean };
type UploadProgress = { completed: number; total: number; error: string | null; complete: boolean; entries: UploadQueueEntry[] } | null;

// The expanded file card is inset from the activity table. These tracks retain
// the parent table's visual column starts despite that inset.
const expandedFileGridColumns = "calc(56% + 20px) calc(13% + 12px) calc(13% + 12px) calc(13% + 12px) calc(5% - 56px)";

function WorkspaceBackgroundIllustration() {
  return (
    <img src={workspaceBackgroundIllustration} alt="" aria-hidden="true" className="pointer-events-none absolute right-0 top-0 hidden w-[31rem] object-contain opacity-60 lg:block" />
  );
}

function UploadQueue({ entries, onCancel }: { entries: readonly UploadQueueEntry[]; onCancel(): void }) {
  return (
    <section aria-label="Upload progress" className="space-y-1.5">
      {entries.map((entry) => (
        <div key={entry.fileName} className="grid min-h-[48px] grid-cols-[minmax(0,1fr)_132px_auto] items-center gap-4 rounded-[5px] bg-white px-5 shadow-[0_1px_4px_rgba(20,47,89,0.07)] ring-1 ring-[#e0e8f2] 2xl:min-h-[58px] 2xl:px-6">
          <div className="flex min-w-0 items-center gap-2 font-elliot text-[11px] text-[#1f2937] 2xl:text-[13px]">
            <FileText className="h-3.5 w-3.5 shrink-0 text-[#16b36f]" />
            <span className="truncate">{entry.fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#edf0f3]"><div className="h-full rounded-full bg-[#1399eb] transition-[width] duration-200" style={{ width: entry.complete ? "100%" : "25%" }} /></div>
            <span className="w-7 font-elliot text-[11px] text-[#89919d]">{entry.complete ? "100%" : "25%"}</span>
          </div>
          <button type="button" onClick={onCancel} className="focus-ring font-elliot text-[11px] text-[#087dca] underline underline-offset-2 2xl:text-[13px]">Cancel</button>
        </div>
      ))}
    </section>
  );
}

export default function BillCycleWorkspace({ workspace }: { workspace: WorkspaceDefinition }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [pipelineCode, setPipelineCode] = useState<string | null>(null);
  const [files, setFiles] = useState<ProcessingPipelineFileDto[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState("");
  const [filterCycle, setFilterCycle] = useState("all");
  const [dragging, setDragging] = useState(false);
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(() => new Set());
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(null);

  useEffect(() => {
    if (!uploadProgress?.complete) return;
    const timer = window.setTimeout(() => setUploadProgress(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [uploadProgress?.complete]);

  const loadFiles = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const result = await apiRequest<ProcessingPipelineFileListDto>(`/processing-pipelines/${encodeURIComponent(code)}/files`);
      setFiles(result.files);
      setConfigured(result.configured);
      setNotice(null);
    } catch (error) {
      setFiles([]);
      setNotice(error instanceof Error ? error.message : "Workspace files could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void apiRequest<ProcessingPipelineCatalogDto>("/processing-pipelines")
      .then((catalog) => {
        const resolvedCode = resolveWorkspacePipelineCode(workspace.id, catalog.pipelines);
        if (!resolvedCode) throw new Error("This workspace is not available in the current pipeline catalog.");
        if (!active) return;
        setPipelineCode(resolvedCode);
        void loadFiles(resolvedCode);
      })
      .catch((error) => {
        if (!active) return;
        setLoading(false);
        setNotice(error instanceof Error ? error.message : "Workspace configuration could not be loaded.");
      });
    return () => { active = false; };
  }, [loadFiles, workspace.id]);

  const cycles = useMemo(() => groupFilesByBillCycle(files), [files]);
  const selectedGroup = cycles.find((group) => group.cycle === selectedCycle);
  const visibleCycles = filterCycle === "all" ? cycles : cycles.filter((group) => group.cycle === filterCycle);

  const uploadFiles = async (selected: FileList | File[]) => {
    if (!pipelineCode || !selectedCycle || !selectedGroup || uploadProgress) return;
    const validation = validateBillCycleUpload(selectedGroup.files, Array.from(selected));
    if (!validation.valid) {
      setUploadProgress({ completed: 0, total: 0, error: validation.message, complete: false, entries: [] });
      return;
    }

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const entries = validation.uploads.map((upload) => ({ fileName: upload.file.name, complete: false }));
    setUploadProgress({ completed: 0, total: validation.uploads.length, error: null, complete: false, entries });
    let completed = 0;
    let errorMessage: string | null = null;
    try {
      for (const upload of validation.uploads) {
        const body = new FormData();
        body.set("expectedFileName", upload.expected.expectedFileName);
        body.set("replace", upload.expected.availability === "present" ? "true" : "false");
        body.set("file", upload.file);
        await apiRequest(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/files`, { method: "POST", body, signal: controller.signal });
        completed += 1;
        setUploadProgress({ completed, total: validation.uploads.length, error: null, complete: false, entries: entries.map((entry, index) => ({ ...entry, complete: index < completed })) });
      }
    } catch (error) {
      errorMessage = controller.signal.aborted ? "Upload cancelled." : error instanceof Error ? error.message : "A file could not be uploaded.";
    } finally {
      uploadAbortRef.current = null;
      await loadFiles(pipelineCode);
      setUploadProgress({ completed, total: validation.uploads.length, error: errorMessage, complete: !errorMessage, entries: entries.map((entry, index) => ({ ...entry, complete: index < completed })) });
    }
  };

  const cancelUpload = () => uploadAbortRef.current?.abort();

  return (
    <div className={workspaceUi.page}>
      <WorkspaceBackgroundIllustration />
      <section className={workspaceUi.content} aria-labelledby="workspace-title">
        <h1 id="workspace-title" className={workspaceUi.title}>{workspace.title}</h1>
        <p className={workspaceUi.description}>{workspace.description}</p>

        {uploadProgress?.complete ? <div role="status" className={workspaceUi.successToast}><CheckCircle2 className="h-4 w-4" />{uploadProgress.total} files successfully uploaded</div> : null}

        {notice ? <div role="alert" className="mt-6 flex items-start gap-2 rounded-[5px] border border-rose-200 bg-rose-50 px-4 py-3 font-elliot text-[13px] text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div> : null}

        <div className={workspaceUi.grid}>
          <section className={`${workspaceUi.panel} ${workspaceUi.uploadPanel}`} aria-labelledby="file-upload-heading">
            <h2 id="file-upload-heading" className={workspaceUi.panelHeading}>FILE UPLOAD</h2>
            <div className={workspaceUi.guidance}>
              <div className="flex items-center gap-2 font-elliot text-[12px] font-bold text-[#171b24] 2xl:gap-3 2xl:text-[14px]"><img src={fileGuidelinesIcon} alt="" className="h-5 w-5 2xl:h-6 2xl:w-6" />File Guidelines</div>
              <p className="mt-3 font-elliot text-[11px] leading-4 text-[#2a3240] 2xl:mt-4 2xl:text-[13px] 2xl:leading-5">All files must follow the correct file name convention:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 font-elliot text-[11px] leading-4 text-[#2a3240] 2xl:mt-2 2xl:space-y-1 2xl:pl-5 2xl:text-[13px] 2xl:leading-5">
                {selectedGroup ? selectedGroup.files.map((file) => <li key={file.id}>{file.expectedFileName}</li>) : <li>Select a bill cycle to see its required files.</li>}
              </ul>
            </div>

            <label className="sr-only" htmlFor="bill-cycle-upload">Bill Cycle</label>
            <select id="bill-cycle-upload" value={selectedCycle} onChange={(event) => { setSelectedCycle(event.target.value); setUploadProgress(null); }} disabled={loading || !cycles.length} className={workspaceUi.cycleSelect}>
              <option value="">{loading ? "Loading bill cycles" : "Bill Cycle"}</option>
              {cycles.map((group) => <option key={group.cycle} value={group.cycle}>Bill Cycle {group.cycle}</option>)}
            </select>
            {selectedGroup ? <p className={workspaceUi.cycleMeta}>{selectedGroup.files.length} required files for Bill Cycle {selectedGroup.cycle}</p> : null}

            <input ref={inputRef} className="sr-only" type="file" multiple onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); event.currentTarget.value = ""; }} />
            <button
              type="button"
              disabled={!selectedGroup || Boolean(uploadProgress && !uploadProgress.complete && !uploadProgress.error)}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); if (selectedGroup) setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadFiles(event.dataTransfer.files); }}
              className={`${workspaceUi.dropZone} ${dragging ? "border-[#087dca] bg-[#eef8ff]" : ""} disabled:cursor-not-allowed disabled:opacity-55`}
            >
              {uploadProgress && !uploadProgress.complete && !uploadProgress.error ? <LoaderCircle className="h-10 w-10 animate-spin text-[#4788f7] 2xl:h-14 2xl:w-14" /> : <CloudUpload className="h-11 w-11 fill-[#4788f7] text-[#4788f7] 2xl:h-14 2xl:w-14" />}
              <span className="mt-3 font-elliot text-[11px] font-bold text-[#087dca] 2xl:mt-4 2xl:text-[13px]">{uploadProgress && !uploadProgress.complete && !uploadProgress.error ? `Uploading ${uploadProgress.completed} of ${uploadProgress.total}` : "Drop files here"}</span>
              <span className="font-elliot text-[11px] text-[#087dca] 2xl:text-[13px]">or click to browse your computer</span>
            </button>
            {uploadProgress && !uploadProgress.complete ? <p role="status" className={`mt-3 flex items-start gap-1.5 font-elliot text-[11px] leading-4 ${uploadProgress.error ? "text-rose-600" : "text-[#087dca]"}`}>{uploadProgress.error ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <LoaderCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />}{uploadProgress.error ?? `Uploading ${uploadProgress.completed} of ${uploadProgress.total} files.`}</p> : null}
          </section>

          <div className="flex min-w-0 flex-col gap-3">
            {uploadProgress && !uploadProgress.complete && !uploadProgress.error && uploadProgress.entries.length ? <UploadQueue entries={uploadProgress.entries} onCancel={cancelUpload} /> : null}
            <section className={`${workspaceUi.panel} ${workspaceUi.activityPanel}`} aria-labelledby="activity-history-heading">
            <div className={workspaceUi.activityHeader}>
              <h2 id="activity-history-heading" className={workspaceUi.panelHeading}>ACTIVITY HISTORY</h2>
              <label className="flex items-center gap-2 font-elliot text-[10px] text-[#252d39]">Filter
                <select value={filterCycle} onChange={(event) => setFilterCycle(event.target.value)} className={workspaceUi.activityFilter}>
                  <option value="all">All Bill Cycle</option>
                  {cycles.map((group) => <option key={group.cycle} value={group.cycle}>Bill Cycle {group.cycle}</option>)}
                </select>
              </label>
            </div>
            <div className={workspaceUi.activityBody}>
              <table className="w-full min-w-[600px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[28%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <thead className={workspaceUi.tableHead}><tr><th className="px-7 py-3 2xl:px-8 2xl:py-4">BATCH CYCLE</th><th className="px-4 py-3 2xl:px-5 2xl:py-4">UPLOADED BY</th><th className="px-4 py-3 2xl:px-5 2xl:py-4">UPLOAD</th><th className="px-4 py-3 2xl:px-5 2xl:py-4">PRELOAD</th><th className="px-4 py-3 2xl:px-5 2xl:py-4">POSTLOAD</th><th className="w-10 px-2 py-3 2xl:w-12 2xl:py-4"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} className="px-7 py-10 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin text-[#087dca]" /></td></tr> : !configured ? <tr><td colSpan={6} className="px-7 py-10 text-center font-elliot text-[12px] text-slate-500">No file mapping is configured for this workspace.</td></tr> : !visibleCycles.length ? <tr><td colSpan={6} className="px-7 py-10 text-center font-elliot text-[12px] text-slate-500">No bill-cycle activity is available.</td></tr> : visibleCycles.map((group) => <ActivityRow key={group.cycle} group={group} expanded={expandedCycles.has(group.cycle)} onToggle={() => setExpandedCycles((current) => { const next = new Set(current); next.has(group.cycle) ? next.delete(group.cycle) : next.add(group.cycle); return next; })} />)}
                </tbody>
              </table>
            </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActivityRow({ group, expanded, onToggle }: { group: ReturnType<typeof groupFilesByBillCycle>[number]; expanded: boolean; onToggle: () => void }) {
  return <>
    <tr className="border-b border-[#dce3ed] bg-white">
      <td className={`${workspaceUi.tableCell} px-7 py-2.5 font-bold`}><button type="button" onClick={onToggle} className="focus-ring inline-flex items-center gap-3 rounded-sm"><ChevronRight className={`h-4 w-4 text-[#1689df] transition-transform ${expanded ? "rotate-90" : ""}`} />Bill Cycle {group.cycle}</button></td>
      <td className={`${workspaceUi.tableCell} px-4 py-2.5`}>—</td><td className={`${workspaceUi.tableCell} px-4 py-2.5`}>{formatBillCycleUploadDate(group.latestUploadAt)}</td><td className={`${workspaceUi.tableCell} px-4 py-2.5`}>—</td><td className={`${workspaceUi.tableCell} px-4 py-2.5`}>—</td>
      <td className="px-2 py-2.5"><button type="button" disabled title="Removing pipeline files is not available through the current API." aria-label={`Remove Bill Cycle ${group.cycle}`} className="grid h-6 w-6 place-items-center rounded text-[#1689df] opacity-80 disabled:cursor-not-allowed"><Trash2 className="h-3.5 w-3.5" /></button></td>
    </tr>
    {expanded ? <tr className="border-b border-[#dce3ed] bg-[#fbfdff]"><td colSpan={6} className="px-7 pb-5 pt-3"><CycleFileDetails files={group.files} /></td></tr> : null}
  </>;
}

function CycleFileDetails({ files }: { files: readonly ProcessingPipelineFileDto[] }) {
  return <div className="overflow-hidden rounded-[5px] border border-[#dce3ed] bg-white">
    <div className="divide-y divide-[#e6ebf2]">
      {files.map((file) => <div key={file.id} style={{ gridTemplateColumns: expandedFileGridColumns }} className="grid min-h-[36px] items-center px-3 font-elliot text-[11px] text-[#1f2937] 2xl:min-h-[44px] 2xl:px-4 2xl:text-[13px]">
        <div className="flex min-w-0 items-center gap-2"><FileText className="h-3.5 w-3.5 shrink-0 text-[#16b36f]" /><span className="truncate">{file.matchedFileName ?? file.expectedFileName}</span></div>
        <span className={file.availability === "present" ? "font-medium text-[#17ad6b]" : "text-[#8b96a6]"}>{file.availability === "present" ? "✓ Read" : "—"}</span>
        <span className="text-[#8b96a6]">—</span><span className="text-[#8b96a6]">—</span>
        <button type="button" disabled title="Removing pipeline files is not available through the current API." aria-label={`Remove ${file.expectedFileName}`} className="grid h-6 w-6 place-items-center rounded text-[#1689df] disabled:cursor-not-allowed"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>)}
    </div>
    <p className="flex items-center gap-1.5 px-3 py-2 font-elliot text-[10px] text-[#252d39]"><AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#ffb400]" />File removal is unavailable because the current pipeline API has no delete endpoint.</p>
  </div>;
}
