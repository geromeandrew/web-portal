import { ExternalLink, FileText, FolderTree, LoaderCircle, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DemoTable from "../components/DemoTable";
import PageHeader from "../components/PageHeader";
import { apiRequest } from "../lib/apiClient";
import type { BillingCycleFileDto, BillingCycleStatus } from "../lib/apiTypes";
import { billingCyclePipelines } from "../lib/billingCyclePipelines";

const statuses: BillingCycleStatus[] = ["inbound", "outbound", "processed", "error"];

function formatSize(size: number) {
  if (size < 1_000) return `${size} B`;
  if (size < 1_000_000) return `${(size / 1_000).toFixed(1)} KB`;
  return `${(size / 1_000_000).toFixed(2)} MB`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

export default function BillingCycleRoute() {
  const [pipelineName, setPipelineName] = useState("");
  const [status, setStatus] = useState<BillingCycleStatus | "">("");
  const [files, setFiles] = useState<BillingCycleFileDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadFiles = useCallback(async (append = false, cursor?: string) => {
    if (!pipelineName || !status) return;
    setLoadingFiles(true);
    try {
      const params = new URLSearchParams({ pipeline_name: pipelineName, status });
      if (append && cursor) params.set("cursor", cursor);
      const response = await apiRequest<{ files: BillingCycleFileDto[]; nextCursor?: string }>(`/billing-cycle/files?${params}`);
      setFiles((current) => append ? [...current, ...response.files] : response.files);
      setNextCursor(response.nextCursor ?? null);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Files could not be loaded.");
      if (!append) setFiles([]);
      setNextCursor(null);
    } finally {
      setLoadingFiles(false);
    }
  }, [pipelineName, status]);

  useEffect(() => {
    setFiles([]);
    setNextCursor(null);
    if (pipelineName && status) void loadFiles();
  }, [pipelineName, status, loadFiles]);

  const rows = useMemo(() => files.map((file) => [file.name, formatDate(file.lastModified), formatSize(file.size)]), [files]);
  const selectedPipeline = billingCyclePipelines.find((pipeline) => pipeline.code === pipelineName);
  const openFile = (name: string) => {
    const file = files.find((candidate) => candidate.name === name);
    if (!file || !pipelineName || !status) return;
    const params = new URLSearchParams({ pipeline_name: pipelineName, status, key: file.key });
    const preview = window.open(`/billing-cycle/files/view?${params}`, "_blank");
    if (!preview) setNotice("The file viewer was blocked by the browser. Allow pop-ups for this portal and try again.");
  };

  const canLoad = Boolean(pipelineName && status);
  return <div className="space-y-8 pb-4">
    <PageHeader eyebrow="Billing Cycle" title="Billing Cycle Files" description="Select a pipeline and processing status to inspect files stored for the current billing cycle.">
      <nav className="portal-tabs" aria-label="Billing Cycle navigation"><Link to="/billing-cycle/files" className="portal-tab portal-tab-active">Files</Link></nav>
    </PageHeader>

    <section className="portal-panel overflow-hidden">
      <div className="flex flex-col gap-5 border-b border-slate-100 bg-gradient-to-r from-teal/[0.05] via-sky-50/70 to-white px-7 py-7 sm:px-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
          <label className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">Pipeline
            <select value={pipelineName} onChange={(event) => setPipelineName(event.target.value)} className="portal-input mt-2 block w-full"><option value="">Select pipeline</option>{billingCyclePipelines.map((pipeline) => <option key={pipeline.code} value={pipeline.code}>{pipeline.label}</option>)}</select>
          </label>
          <label className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">Status
            <select value={status} onChange={(event) => setStatus(event.target.value as BillingCycleStatus | "")} className="portal-input mt-2 block w-full"><option value="">Select status</option>{statuses.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select>
          </label>
        </div>
        <button onClick={() => void loadFiles()} disabled={!canLoad || loadingFiles} className="focus-ring portal-button-secondary"><RefreshCcw className={`h-4 w-4 ${loadingFiles ? "animate-spin" : ""}`} />Refresh</button>
      </div>

      {notice ? <div className="portal-alert mx-7 mt-7 border-rose-200 bg-rose-50 text-rose-700 sm:mx-10">{notice}</div> : null}
      <div className="p-7 sm:p-10">
        {!canLoad ? <div className="grid min-h-64 place-items-center text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-teal/10 text-teal"><FolderTree className="h-6 w-6" /></span><p className="mt-4 text-[14px] font-semibold text-slate-700">Choose a pipeline and status</p><p className="mt-1 text-[13px] text-slate-500">Files will appear once both filters are selected.</p></div></div> : loadingFiles && files.length === 0 ? <div className="grid min-h-64 place-items-center text-[13px] font-medium text-slate-500"><span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin text-teal" />Loading files…</span></div> : <><DemoTable ariaLabel="Billing Cycle files" caption={`${selectedPipeline?.label ?? pipelineName} / ${status}`} headers={["File Name", "Last Modified", "Size"]} rows={rows} emptyMessage="No files were found for this pipeline and status." actions={(row) => <button onClick={() => openFile(row[0])} className="focus-ring inline-flex items-center gap-1.5 rounded-[9px] bg-teal/10 px-2.5 py-2 text-[11px] font-bold text-teal transition hover:bg-teal hover:text-white" aria-label={`View ${row[0]}`}><ExternalLink className="h-3.5 w-3.5" />View</button>} />{nextCursor ? <div className="mt-5 flex justify-center"><button onClick={() => void loadFiles(true, nextCursor)} disabled={loadingFiles} className="focus-ring portal-button-secondary">{loadingFiles ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}Load more files</button></div> : null}</>}
      </div>
    </section>
  </div>;
}
