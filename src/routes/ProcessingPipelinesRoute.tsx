import { AlertCircle, CheckCircle2, ExternalLink, FolderTree, LoaderCircle, Play, RefreshCcw, ShieldCheck, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import DemoTable from "../components/DemoTable";
import PageHeader from "../components/PageHeader";
import { apiRequest } from "../lib/apiClient";
import type { ProcessingPipelineBatchExecutionDetailsDto, ProcessingPipelineBatchRunDto, ProcessingPipelineCatalogDto, ProcessingPipelineExecutionDetailsDto, ProcessingPipelineFileDto, ProcessingPipelineFileListDto, ProcessingPipelineRunDto, ProcessingPipelineRunStatusDto, ProcessingPipelineStage } from "../lib/apiTypes";

const stages: { code: ProcessingPipelineStage; label: string }[] = [{ code: "inbound", label: "Inbound" }, { code: "outbound", label: "Outbound" }, { code: "processed", label: "Processed" }, { code: "error", label: "Error" }];
const terminalStatuses = new Set(["SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED", "PENDING_REDRIVE", "STATUS_UNAVAILABLE"]);
const formatSize = (size: number | null) => size === null ? "—" : size < 1_000_000 ? `${(size / 1_000).toFixed(1)} KB` : `${(size / 1_000_000).toFixed(2)} MB`;
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : "—";
type UploadState = { status: "uploading" | "uploaded" | "failed"; message?: string };
type PendingAction = { kind: "single"; file: ProcessingPipelineFileDto; details: ProcessingPipelineExecutionDetailsDto } | { kind: "batch"; details: ProcessingPipelineBatchExecutionDetailsDto };

export default function ProcessingPipelinesRoute() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"files" | "batch">("files");
  const [pipelineCode, setPipelineCode] = useState("");
  const [stage, setStage] = useState<ProcessingPipelineStage>("inbound");
  const [catalog, setCatalog] = useState<ProcessingPipelineCatalogDto>({ pipelines: [] });
  const [files, setFiles] = useState<ProcessingPipelineFileDto[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [starting, setStarting] = useState(false);
  const [runs, setRuns] = useState<Record<string, ProcessingPipelineRunStatusDto>>({});
  const [batchCycle, setBatchCycle] = useState("");
  const [batchDetails, setBatchDetails] = useState<ProcessingPipelineBatchExecutionDetailsDto | null>(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const pendingUpload = useRef<ProcessingPipelineFileDto | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  const isAdmin = Boolean(user);

  const loadFiles = useCallback(async () => {
    if (!pipelineCode) return;
    setLoadingFiles(true);
    try {
      const result = await apiRequest<ProcessingPipelineFileListDto>(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/files`);
      setFiles(result.files); setConfigured(result.configured); setNotice(null);
    } catch (error) { setFiles([]); setNotice(error instanceof Error ? error.message : "Pipeline files could not be loaded."); }
    finally { setLoadingFiles(false); }
  }, [pipelineCode]);

  const pollRun = useCallback(async (runKey: string, runId: string) => {
    if (!pipelineCode) return;
    try {
      const status = await apiRequest<ProcessingPipelineRunStatusDto>(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/runs/${encodeURIComponent(runId)}`);
      setRuns((current) => ({ ...current, [runKey]: status }));
      if (!terminalStatuses.has(status.status)) timers.current.push(window.setTimeout(() => void pollRun(runKey, runId), 5000));
    } catch (error) {
      setRuns((current) => ({ ...current, [runKey]: { runId, targetMode: "adhoc", stateMachineName: "Unavailable", status: "STATUS_UNAVAILABLE", errorCode: null, errorMessage: error instanceof Error ? error.message : "Run status could not be loaded.", startedAt: null, completedAt: null, stepFunctionsConsoleUrl: "" } }));
    }
  }, [pipelineCode]);
  const schedulePoll = useCallback((runKey: string, runId: string) => { timers.current.push(window.setTimeout(() => void pollRun(runKey, runId), 1200)); }, [pollRun]);

  useEffect(() => { void apiRequest<ProcessingPipelineCatalogDto>("/processing-pipelines").then(setCatalog).catch((error) => setNotice(error instanceof Error ? error.message : "Processing Pipelines could not be loaded.")); }, []);
  useEffect(() => { setFiles([]); setRuns({}); setUploads({}); setBatchDetails(null); setBatchCycle(""); if (pipelineCode) void loadFiles(); }, [pipelineCode, loadFiles]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  useEffect(() => { if (!pendingAction) return; const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !starting) setPendingAction(null); }; document.addEventListener("keydown", onKeyDown); return () => document.removeEventListener("keydown", onKeyDown); }, [pendingAction, starting]);

  const batchCycles = useMemo(() => [...new Set(files.flatMap((file) => file.stepFunction?.batchCycle ? [file.stepFunction.batchCycle] : []))].sort(), [files]);
  useEffect(() => { if (batchCycles.length && !batchCycles.includes(batchCycle)) setBatchCycle(batchCycles[0]); }, [batchCycle, batchCycles]);
  const loadBatchDetails = useCallback(async () => {
    if (!pipelineCode || !batchCycle || !isAdmin) return;
    setLoadingBatch(true);
    try { setBatchDetails(await apiRequest<ProcessingPipelineBatchExecutionDetailsDto>(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/batch-execution-details?${new URLSearchParams({ batchCycle })}`)); }
    catch (error) { setBatchDetails(null); setNotice(error instanceof Error ? error.message : "Batch readiness could not be loaded."); }
    finally { setLoadingBatch(false); }
  }, [batchCycle, isAdmin, pipelineCode]);
  useEffect(() => { if (activeTab === "batch" && batchCycle) void loadBatchDetails(); }, [activeTab, batchCycle, loadBatchDetails]);

  const viewFile = (file: ProcessingPipelineFileDto) => { if (file.key && pipelineCode) window.open(`/processing-pipelines/files/view?${new URLSearchParams({ pipelineCode, key: file.key })}`, "_blank", "noopener,noreferrer"); };
  const uploadFile = async (selected?: File) => {
    const file = pendingUpload.current; pendingUpload.current = null;
    if (!selected || !file || !pipelineCode || stage !== "inbound") return;
    const form = new FormData(); form.set("expectedFileName", file.expectedFileName); form.set("replace", file.availability === "present" ? "true" : "false"); form.set("file", selected);
    setUploads((current) => ({ ...current, [file.expectedFileName]: { status: "uploading" } }));
    try { await apiRequest(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/files`, { method: "POST", body: form }); setUploads((current) => ({ ...current, [file.expectedFileName]: { status: "uploaded", message: "Uploaded successfully." } })); setBatchDetails(null); await loadFiles(); }
    catch (error) { setUploads((current) => ({ ...current, [file.expectedFileName]: { status: "failed", message: error instanceof Error ? error.message : "The file could not be uploaded." } })); }
  };
  const prepareSingle = async (file: ProcessingPipelineFileDto) => {
    if (!pipelineCode || !isAdmin) return;
    try { const details = await apiRequest<ProcessingPipelineExecutionDetailsDto>(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/execution-details?${new URLSearchParams({ expectedFileName: file.expectedFileName })}`); setPendingAction({ kind: "single", file, details }); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Execution readiness could not be loaded."); }
  };
  const startPendingAction = async () => {
    if (!pendingAction || !pipelineCode) return;
    setStarting(true);
    try {
      if (pendingAction.kind === "single") {
        const run = await apiRequest<ProcessingPipelineRunDto>(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/runs`, { method: "POST", body: JSON.stringify({ expectedFileName: pendingAction.file.expectedFileName }) });
        setRuns((current) => ({ ...current, [pendingAction.file.expectedFileName]: { ...run, status: "STARTING", errorCode: null, errorMessage: null, completedAt: null, stepFunctionsConsoleUrl: "" } })); schedulePoll(pendingAction.file.expectedFileName, run.runId);
      } else {
        const result = await apiRequest<ProcessingPipelineBatchRunDto>(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/batch-runs`, { method: "POST", body: JSON.stringify({ batchCycle: pendingAction.details.batchCycle }) });
        if (result.runId) { const key = `Batch cycle ${pendingAction.details.batchCycle}`; setRuns((current) => ({ ...current, [key]: { runId: result.runId!, targetMode: "batch", stateMachineName: result.stateMachineName ?? "Batch workflow", status: "STARTING", errorCode: null, errorMessage: null, startedAt: result.startedAt ?? null, completedAt: null, stepFunctionsConsoleUrl: "" } })); schedulePoll(key, result.runId); }
        for (const run of result.startedRuns ?? []) { setRuns((current) => ({ ...current, [run.expectedFileName]: { runId: run.runId, targetMode: "adhoc", stateMachineName: run.stateMachineName, status: "STARTING", errorCode: null, errorMessage: null, startedAt: run.startedAt, completedAt: null, stepFunctionsConsoleUrl: "" } })); schedulePoll(run.expectedFileName, run.runId); }
        if (result.failedFiles?.length) setNotice(`${result.failedFiles.length} batch workflow${result.failedFiles.length === 1 ? "" : "s"} could not be started.`);
        await loadBatchDetails();
      }
      setPendingAction(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The execution could not be started."); }
    finally { setStarting(false); }
  };

  const rows = useMemo(() => files.map((file) => [file.expectedFileName, file.matchedFileName ?? "—", file.availability === "present" ? "Available" : "Missing", file.stepFunction?.stateMachineName ?? "Not mapped", formatDate(file.lastModified), formatSize(file.size)]), [files]);
  const pipeline = catalog.pipelines.find((item) => item.code === pipelineCode);
  return <div className="space-y-8 pb-4">
    <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv,.txt" className="sr-only" onChange={(event) => { void uploadFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    <PageHeader eyebrow="Processing Pipelines" title="Pipeline operations" description="Inspect inbound source files, manage uploads, and start mapped workflows with clear readiness checks." />
    <section className="portal-panel overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-teal/[0.05] via-sky-50/70 to-white px-7 pt-7 sm:px-10 sm:pt-8">
        <div className="portal-tabs w-fit" role="tablist" aria-label="Processing pipeline workspace"><button role="tab" aria-selected={activeTab === "files"} onClick={() => setActiveTab("files")} className={`portal-tab ${activeTab === "files" ? "portal-tab-active" : ""}`}>Pipeline files</button><button role="tab" aria-selected={activeTab === "batch"} onClick={() => setActiveTab("batch")} className={`portal-tab ${activeTab === "batch" ? "portal-tab-active" : ""}`}>Batch executions</button></div>
        <div className="flex flex-col gap-4 py-6 lg:flex-row lg:items-end lg:justify-between"><div className="grid flex-1 gap-4 sm:grid-cols-2 lg:max-w-2xl"><label className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">Pipeline<select value={pipelineCode} onChange={(event) => setPipelineCode(event.target.value)} className="portal-input mt-2 block w-full"><option value="">Select pipeline</option>{catalog.pipelines.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label><label className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">Stage<select value={stage} onChange={(event) => setStage(event.target.value as ProcessingPipelineStage)} className="portal-input mt-2 block w-full">{stages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label></div><button onClick={() => void loadFiles()} disabled={!pipelineCode || loadingFiles} className="focus-ring portal-button-secondary"><RefreshCcw className={`h-4 w-4 ${loadingFiles ? "animate-spin" : ""}`} />Refresh files</button></div>
      </div>
      {notice ? <div className="portal-alert mx-7 mt-7 border-rose-200 bg-rose-50 text-rose-700 sm:mx-10" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div> : null}
      <div className="p-7 sm:p-10">{!pipelineCode ? <EmptyState /> : activeTab === "files" ? <FilesTab files={files} rows={rows} pipeline={pipeline?.label ?? pipelineCode} stage={stage} loading={loadingFiles} configured={configured} uploads={uploads} isAdmin={isAdmin} runs={runs} onView={viewFile} onUpload={(file) => { pendingUpload.current = file; fileInput.current?.click(); }} onExecute={prepareSingle} /> : <BatchTab batchCycles={batchCycles} batchCycle={batchCycle} onBatchCycleChange={setBatchCycle} isAdmin={isAdmin} loading={loadingBatch} details={batchDetails} onRefresh={() => void loadBatchDetails()} onExecute={() => batchDetails && setPendingAction({ kind: "batch", details: batchDetails })} />}</div>
    </section>
    {Object.keys(runs).length ? <LiveRuns runs={runs} /> : null}
    {pendingAction ? <ExecutionDialog action={pendingAction} starting={starting} onCancel={() => setPendingAction(null)} onConfirm={() => void startPendingAction()} /> : null}
  </div>;
}

function EmptyState() { return <div className="grid min-h-64 place-items-center text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-teal/10 text-teal"><FolderTree className="h-6 w-6" /></span><p className="mt-4 text-[14px] font-semibold text-slate-700">Choose a pipeline to begin</p><p className="mt-1 text-[13px] text-slate-500">The selected stage provides workflow context for the inbound source inventory.</p></div></div>; }
function FilesTab({ files, rows, pipeline, stage, loading, configured, uploads, isAdmin, runs, onView, onUpload, onExecute }: { files: ProcessingPipelineFileDto[]; rows: string[][]; pipeline: string; stage: ProcessingPipelineStage; loading: boolean; configured: boolean; uploads: Record<string, UploadState>; isAdmin: boolean; runs: Record<string, ProcessingPipelineRunStatusDto>; onView: (file: ProcessingPipelineFileDto) => void; onUpload: (file: ProcessingPipelineFileDto) => void; onExecute: (file: ProcessingPipelineFileDto) => void }) {
  if (loading && !files.length) return <div className="grid min-h-64 place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-teal" /></div>;
  if (!configured) return <p className="py-16 text-center text-sm text-slate-500">No file mapping is configured for this pipeline.</p>;
  return <div className="space-y-5"><div className="flex items-start gap-3 rounded-xl bg-sky-50/70 px-4 py-3 text-[13px] leading-6 text-slate-600"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal" />The source inventory is stored in <b>Inbound</b>. <span>Stage is set to <b>{stage}</b>; uploads are available only in Inbound.</span></div>{!isAdmin ? <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500"><ShieldCheck className="h-4 w-4 text-slate-400" />Execute actions require administrator permission.</div> : null}<DemoTable ariaLabel="Processing pipeline files" caption={`${pipeline} · ${stage} stage context`} headers={["Source file", "Stored file", "Availability", "Mapped workflow", "Last modified", "Size"]} rows={rows} wrapColumns={[0, 1, 3]} actionPosition="end" actionWidth={278} columnWidths={{ 0: 260, 1: 230, 2: 105, 3: 260, 4: 170, 5: 90 }} actions={(row) => { const file = files.find((item) => item.expectedFileName === row[0]); if (!file) return null; const upload = uploads[file.expectedFileName]; const viewDisabled = !file.key; const uploadDisabled = stage !== "inbound" || upload?.status === "uploading"; const executeDisabled = !isAdmin || file.availability !== "present" || !file.stepFunction; const uploadReason = stage !== "inbound" ? "Uploads are available only in Inbound." : undefined; const executeReason = !isAdmin ? "Administrator permission required." : file.availability !== "present" ? "Upload the source file before executing." : !file.stepFunction ? "No mapped workflow is configured." : undefined; return <div className="flex w-[246px] flex-wrap gap-2"><button disabled={viewDisabled} title={viewDisabled ? "No stored source file is available." : undefined} onClick={() => onView(file)} className="focus-ring inline-flex items-center gap-1.5 rounded-[9px] bg-teal/10 px-2.5 py-2 text-[11px] font-bold text-teal disabled:cursor-not-allowed disabled:opacity-40"><ExternalLink className="h-3.5 w-3.5" />View</button><button disabled={uploadDisabled} title={uploadReason} onClick={() => onUpload(file)} className="focus-ring inline-flex items-center gap-1.5 rounded-[9px] bg-slate-100 px-2.5 py-2 text-[11px] font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50">{upload?.status === "uploading" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{upload?.status === "uploading" ? "Uploading" : "Upload"}</button><button disabled={executeDisabled} title={executeReason} onClick={() => void onExecute(file)} className="focus-ring inline-flex items-center gap-1.5 rounded-[9px] bg-teal px-2.5 py-2 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"><Play className="h-3.5 w-3.5" />Execute</button>{upload?.message ? <p className={`w-full text-[11px] font-semibold ${upload.status === "failed" ? "text-rose-600" : "text-emerald-600"}`}>{upload.status === "uploaded" ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : null}{upload.message}</p> : null}{runs[file.expectedFileName] ? <p className="w-full text-[11px] font-semibold text-slate-500">Execution: {runs[file.expectedFileName].status}</p> : null}</div>; }} /></div>;
}
function BatchTab({ batchCycles, batchCycle, onBatchCycleChange, isAdmin, loading, details, onRefresh, onExecute }: { batchCycles: string[]; batchCycle: string; onBatchCycleChange: (value: string) => void; isAdmin: boolean; loading: boolean; details: ProcessingPipelineBatchExecutionDetailsDto | null; onRefresh: () => void; onExecute: () => void }) { return <div className="space-y-6"><div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between"><label className="block w-full max-w-sm text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">Bill cycle<select value={batchCycle} disabled={!batchCycles.length} onChange={(event) => onBatchCycleChange(event.target.value)} className="portal-input mt-2 block w-full"><option value="">{batchCycles.length ? "Select cycle" : "No mapped batch cycles"}</option>{batchCycles.map((cycle) => <option key={cycle} value={cycle}>Cycle {cycle}</option>)}</select></label><button onClick={onRefresh} disabled={!isAdmin || !batchCycle || loading} className="focus-ring portal-button-secondary"><RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Check readiness</button></div>{!isAdmin ? <div className="portal-alert border-amber-200 bg-amber-50 text-amber-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Batch execution requires administrator permission.</div> : !batchCycles.length ? <div className="py-16 text-center"><p className="font-semibold text-slate-700">Batch execution is not mapped for this pipeline.</p><p className="mt-2 text-sm text-slate-500">Choose a pipeline with mapped batch cycles to continue.</p></div> : loading ? <div className="grid min-h-48 place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-teal" /></div> : details ? <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><Metric label="Execution mode" value={details.targetMode === "batch" ? "Full batch" : "Partial batch"} /><Metric label="Available files" value={String(details.sourceFiles.length)} /><Metric label="Missing files" value={String(details.missingFiles.length)} /></div><div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold text-slate-800">Ready for cycle {details.batchCycle}</p><p className="mt-1 text-sm leading-6 text-slate-600">{details.targetMode === "batch" ? "All mapped sources are available; one batch workflow will start." : "Available sources will start as individual workflows."}</p>{details.blockingReasons.length ? <p className="mt-2 text-sm font-medium text-rose-700">Blocked: {details.blockingReasons.join(", ")}</p> : null}</div><button onClick={onExecute} disabled={!details.canExecute} className="focus-ring portal-button-primary shrink-0"><Play className="h-4 w-4" />Execute batch</button></div></div><div className="grid gap-4 lg:grid-cols-2"><FileList title="Available source files" items={details.sourceFiles.map((file) => file.expectedFileName)} tone="good" /><FileList title="Missing source files" items={details.missingFiles.map((file) => file.expectedFileName)} tone="warn" /></div></div> : <div className="py-16 text-center text-sm text-slate-500">Select a mapped bill cycle to check its execution readiness.</div>}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-100 bg-white px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p><p className="mt-2 text-lg font-bold text-slate-800">{value}</p></div>; }
function FileList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "warn" }) { return <div className="rounded-xl border border-slate-100 bg-white p-4"><p className="text-[12px] font-bold text-slate-700">{title} <span className={tone === "good" ? "text-emerald-600" : "text-amber-600"}>({items.length})</span></p><div className="mt-3 max-h-44 space-y-2 overflow-auto text-[12px] text-slate-600">{items.length ? items.map((item) => <p key={item} className="truncate">{item}</p>) : <p className="text-slate-400">None</p>}</div></div>; }
function LiveRuns({ runs }: { runs: Record<string, ProcessingPipelineRunStatusDto> }) { return <section className="portal-panel overflow-hidden"><div className="border-b border-slate-100 px-6 py-5 sm:px-8"><p className="portal-eyebrow">Live status</p><h2 className="portal-section-title mt-2">Current executions</h2></div><div className="divide-y divide-slate-100">{Object.entries(runs).map(([label, run]) => <div key={label} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-slate-700">{label}</p><p className="mt-1 truncate text-[12px] text-slate-500">{run.stateMachineName} · {run.runId}</p>{run.errorMessage ? <p className="mt-1 text-[12px] text-rose-600">{run.errorMessage}</p> : null}</div><span className={`portal-status w-fit ${run.status === "SUCCEEDED" ? "bg-emerald-50 text-emerald-700" : run.status === "FAILED" || run.status === "TIMED_OUT" || run.status === "ABORTED" || run.status === "STATUS_UNAVAILABLE" ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"}`}>{run.status === "STARTING" || run.status === "RUNNING" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}{run.status}</span></div>)}</div></section>; }
function ExecutionDialog({ action, starting, onCancel, onConfirm }: { action: PendingAction; starting: boolean; onCancel: () => void; onConfirm: () => void }) {
  const details = action.details;
  const title = action.kind === "batch" ? `Execute batch cycle ${action.details.batchCycle}?` : "Execute mapped workflow?";
  const summary = action.kind === "batch" ? action.details.targetMode === "batch" ? "This starts the mapped batch workflow for every available source file." : "This starts an individual workflow for each available source file." : `This starts the workflow mapped to ${action.file.expectedFileName}.`;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4"><div role="dialog" aria-modal="true" aria-labelledby="execution-dialog-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-panel"><p className="portal-eyebrow">Execution readiness</p><h2 id="execution-dialog-title" className="font-heading mt-2 text-xl font-bold text-slate-900">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{summary}</p>{details.blockingReasons.length ? <div className="portal-alert mt-5 border-rose-200 bg-rose-50 text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{details.blockingReasons.join(", ")}</div> : <div className="portal-alert mt-5 border-emerald-200 bg-emerald-50 text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />The mapped workflow is ready to start.</div>}<div className="mt-6 flex justify-end gap-3"><button disabled={starting} onClick={onCancel} className="focus-ring portal-button-secondary">Cancel</button><button disabled={!details.canExecute || starting} onClick={onConfirm} className="focus-ring portal-button-primary">{starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{starting ? "Starting" : "Start execution"}</button></div></div></div>;
}
