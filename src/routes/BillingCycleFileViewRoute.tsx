import { ArrowLeft, Download, FileWarning, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { fetchApiFile } from "../lib/apiClient";
import type { BillingCycleStatus } from "../lib/apiTypes";

const validStatuses = new Set<BillingCycleStatus>(["inbound", "outbound", "processed", "error"]);

function supportsPreview(contentType: string) {
  return contentType === "application/pdf" || contentType.startsWith("image/") || contentType.startsWith("text/");
}

export default function BillingCycleFileViewRoute() {
  const [params] = useSearchParams();
  const pipelineName = params.get("pipeline_name") ?? "";
  const status = params.get("status") ?? "";
  const key = params.get("key") ?? "";
  const [url, setUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.opener = null;
    if (!pipelineName || !key || !validStatuses.has(status as BillingCycleStatus)) {
      setError("This viewer link is incomplete or invalid.");
      return;
    }
    let objectUrl: string | null = null;
    let active = true;
    void fetchApiFile(`/billing-cycle/files/content?${new URLSearchParams({ pipeline_name: pipelineName, status, key })}`).then((file) => {
      objectUrl = URL.createObjectURL(file.blob);
      if (active) {
        setUrl(objectUrl);
        setContentType(file.contentType);
      }
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key, pipelineName, status]);

  const filename = key.split("/").at(-1) ?? "Billing Cycle file";
  const previewable = supportsPreview(contentType);
  return <div className="space-y-8 pb-4">
    <PageHeader eyebrow="Billing Cycle" title={filename} description={`${pipelineName}${status ? ` / ${status}` : ""}`}>
      <Link to="/billing-cycle/files" className="focus-ring inline-flex items-center gap-2 rounded-lg text-[13px] font-semibold text-teal"><ArrowLeft className="h-4 w-4" />Back to files</Link>
    </PageHeader>
    <section className="portal-panel min-h-[420px] overflow-hidden p-5 sm:p-8">
      {error ? <div className="grid min-h-80 place-items-center text-center"><div><FileWarning className="mx-auto h-8 w-8 text-rose-500" /><p className="mt-4 text-[14px] font-semibold text-slate-700">Unable to load this file</p><p className="mt-1 text-[13px] text-slate-500">{error}</p></div></div> : !url ? <div className="grid min-h-80 place-items-center text-[13px] font-medium text-slate-500"><span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin text-teal" />Loading secure file…</span></div> : previewable ? contentType.startsWith("image/") ? <div className="grid min-h-[360px] place-items-center bg-slate-50"><img src={url} alt={filename} className="max-h-[70vh] max-w-full object-contain" /></div> : <iframe title={filename} src={url} className="min-h-[70vh] w-full rounded-xl border border-slate-200" /> : <div className="grid min-h-80 place-items-center text-center"><div><FileWarning className="mx-auto h-8 w-8 text-teal" /><p className="mt-4 text-[14px] font-semibold text-slate-700">Preview is not available for this file type</p><p className="mt-1 text-[13px] text-slate-500">Download the file to open it in its associated application.</p><a href={url} download={filename} className="focus-ring portal-button-primary mt-6"><Download className="h-4 w-4" />Download file</a></div></div>}
    </section>
  </div>;
}
