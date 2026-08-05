import { ExternalLink, LoaderCircle, Play, RefreshCcw, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import PageHeader from "../components/PageHeader";
import { apiRequest } from "../lib/apiClient";
import type { ProcessingPipelineCatalogDto, ProcessingPipelineFileDto, ProcessingPipelineFileListDto, ProcessingPipelineRunDto, ProcessingPipelineRunStatusDto, ProcessingPipelineStage } from "../lib/apiTypes";

const stages = new Set<ProcessingPipelineStage>(["inbound", "outbound", "processed", "error"]);
const formatSize = (size: number | null) => size === null ? "—" : size < 1_000_000 ? `${(size / 1_000).toFixed(1)} KB` : `${(size / 1_000_000).toFixed(2)} MB`;

export default function ProcessingPipelinesRoute() {
  const { user } = useAuth();
  const [pipelineCode, setPipelineCode] = useState("");
  const [stage, setStage] = useState<ProcessingPipelineStage | "">("");
  const [catalog, setCatalog] = useState<ProcessingPipelineCatalogDto>({ pipelines: [], stages: [] });
  const [files, setFiles] = useState<ProcessingPipelineFileDto[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, ProcessingPipelineRunStatusDto>>({});
  const pendingUpload = useRef<ProcessingPipelineFileDto | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    if (!pipelineCode || !stage) return;
    setLoading(true);
    try { const response = await apiRequest<ProcessingPipelineFileListDto>(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/files?${new URLSearchParams({ stage })}`); setFiles(response.files); setConfigured(response.configured); setNotice(null); }
    catch (error) { setFiles([]); setNotice(error instanceof Error ? error.message : "Pipeline files could not be loaded."); }
    finally { setLoading(false); }
  }, [pipelineCode, stage]);

  useEffect(() => { void apiRequest<ProcessingPipelineCatalogDto>("/processing-pipelines").then(setCatalog).catch((error) => setNotice(error instanceof Error ? error.message : "Processing Pipelines could not be loaded.")); }, []);
  useEffect(() => { setFiles([]); setRuns({}); if (pipelineCode && stage) void loadFiles(); }, [pipelineCode, stage, loadFiles]);

  const viewFile = (file: ProcessingPipelineFileDto) => { if (!file.key || !pipelineCode || !stage) return; const params = new URLSearchParams({ pipelineCode, stage, key: file.key }); window.open(`/processing-pipelines/files/view?${params}`, "_blank"); };
  const uploadFile = async (selected?: File) => { const target = pendingUpload.current; pendingUpload.current = null; if (!selected || !target || !pipelineCode || !stage) return; const form = new FormData(); form.set("stage", stage); form.set("expectedFileName", target.expectedFileName); form.set("replace", target.availability === "present" ? "true" : "false"); form.set("file", selected); try { await apiRequest(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/files`, { method: "POST", body: form }); await loadFiles(); } catch (error) { setNotice(error instanceof Error ? error.message : "The file could not be uploaded."); } };
  const startRun = async (file: ProcessingPipelineFileDto) => { if (!pipelineCode || !stage || !file.jobName) return; try { const run = await apiRequest<ProcessingPipelineRunDto>(`/processing-pipelines/${encodeURIComponent(pipelineCode)}/runs`, { method: "POST", body: JSON.stringify({ stage, expectedFileName: file.expectedFileName }) }); setRuns((current) => ({ ...current, [file.expectedFileName]: { ...run, status: "STARTING", errorMessage: null, completedAt: null, glueConsoleUrl: "", cloudWatchLogsUrl: "" } })); } catch (error) { setNotice(error instanceof Error ? error.message : "The processing job could not be started."); } };
  const selectedPipeline = catalog.pipelines.find((pipeline) => pipeline.code === pipelineCode);

  return <div className="space-y-8 pb-4">
    <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv,.txt" className="sr-only" onChange={(event) => void uploadFile(event.target.files?.[0])} />
    <PageHeader eyebrow="Processing Pipelines" title="Pipeline Files" description="View configured files, upload source data, and start mapped processing jobs." />
    <section className="portal-panel overflow-hidden"><div className="grid gap-4 border-b border-slate-100 bg-slate-50 p-7 sm:grid-cols-3"><label className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">Pipeline<select value={pipelineCode} onChange={(event) => setPipelineCode(event.target.value)} className="portal-input mt-2 block w-full"><option value="">Select pipeline</option>{catalog.pipelines.map((pipeline) => <option key={pipeline.code} value={pipeline.code}>{pipeline.label}</option>)}</select></label><label className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">Stage<select value={stage} onChange={(event) => setStage(event.target.value as ProcessingPipelineStage | "")} className="portal-input mt-2 block w-full"><option value="">Select stage</option>{catalog.stages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label><button onClick={() => void loadFiles()} disabled={!pipelineCode || !stage || loading} className="focus-ring portal-button-secondary self-end"><RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button></div>
    {notice ? <div className="portal-alert m-7 border-rose-200 bg-rose-50 text-rose-700">{notice}</div> : null}
    {!pipelineCode || !stage ? <p className="p-10 text-center text-sm text-slate-500">Choose a pipeline and stage to view its file requirements.</p> : !configured ? <p className="p-10 text-center text-sm text-slate-500">No file mapping is configured for {selectedPipeline?.label ?? pipelineCode} / {stage}.</p> : <div className="overflow-x-auto p-7"><table className="min-w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">File</th><th className="p-3">Availability</th><th className="p-3">Modified</th><th className="p-3">Size</th><th className="p-3">Actions</th></tr></thead><tbody>{files.map((file) => <tr key={file.id} className="border-b"><td className="p-3 font-medium">{file.matchedFileName ?? file.expectedFileName}</td><td className="p-3">{file.availability === "present" ? "Present" : "Missing"}</td><td className="p-3">{file.lastModified ? new Date(file.lastModified).toLocaleString() : "—"}</td><td className="p-3">{formatSize(file.size)}</td><td className="flex gap-2 p-3">{file.key ? <button onClick={() => viewFile(file)} className="focus-ring portal-button-secondary"><ExternalLink className="h-4 w-4" />View</button> : null}<button onClick={() => { pendingUpload.current = file; fileInput.current?.click(); }} className="focus-ring portal-button-secondary"><Upload className="h-4 w-4" />Upload</button>{user?.isBootstrapAdmin && file.availability === "present" && file.jobName ? <button onClick={() => void startRun(file)} className="focus-ring portal-button-primary"><Play className="h-4 w-4" />Run</button> : null}{runs[file.expectedFileName] ? <span className="self-center text-xs text-slate-500">{runs[file.expectedFileName].status}</span> : null}</td></tr>)}</tbody></table>{loading ? <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading files</p> : null}</div>}</section>
  </div>;
}
