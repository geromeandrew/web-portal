import { Download, ExternalLink, LoaderCircle, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DemoTable from "../components/DemoTable";
import PageHeader from "../components/PageHeader";
import { apiRequest, downloadApiFile } from "../lib/apiClient";
import { uploadSingleFile, validateWorkflowFile } from "../lib/uploadClient";
import { createUploadId } from "../lib/uploadId";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type MemoFile = { id: string; name: string; status: "uploading" | "success" | "error"; progress: number; created: string; size: string; message?: string };

export default function MemoRoute() {
  const { section = "file-upload" } = useParams();
  const [files, setFiles] = useState<MemoFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [memoHeaders, setMemoHeaders] = useState<string[]>([]);
  const [memoErrors, setMemoErrors] = useState<string[][]>([]);
  const isErrors = section === "error-page";

  useEffect(() => {
    void apiRequest<{ errors: { headers: string[]; rows: string[][] } }>("/workflows/memo/state").then(({ errors }) => { setMemoHeaders(errors.headers); setMemoErrors(errors.rows); }).catch((error: Error) => setNotice(error.message));
  }, []);

  const selectFiles = async (selected: File[]) => {
    setNotice(null);
    const valid = selected.filter((file) => {
      const error = validateWorkflowFile(file, [XLSX]);
      if (error) setNotice(error);
      return !error;
    });
    await Promise.all(valid.map(async (file) => {
      const id = createUploadId();
      setFiles((current) => [{ id, name: file.name, status: "uploading", progress: 3, created: new Date().toLocaleString(), size: `${(file.size / 1_000_000).toFixed(2)}` }, ...current]);
      try {
        await uploadSingleFile(file, (progress) => setFiles((current) => current.map((item) => item.id === id ? { ...item, progress } : item)), "memo");
        setFiles((current) => current.map((item) => item.id === id ? { ...item, status: "success", progress: 100 } : item));
      } catch (error) {
        setFiles((current) => current.map((item) => item.id === id ? { ...item, status: "error", progress: 0, message: error instanceof Error ? error.message : "Upload failed." } : item));
      }
    }));
  };

  return <div className="space-y-10 pb-4">
    <PageHeader eyebrow="MemoApp SST" title={`MemoApp Standard Source Template — ${isErrors ? "Error Page" : "File Upload"}`} description={isErrors ? "Review and export records that require attention." : "Upload standard source templates and monitor their transfer status."}>
      <nav className="portal-tabs" aria-label="MemoApp navigation"><Link to="/memo/file-upload" className={`portal-tab ${!isErrors ? "portal-tab-active" : ""}`}>File Upload</Link><Link to="/memo/error-page" className={`portal-tab ${isErrors ? "portal-tab-active" : ""}`}>Error Page</Link></nav>
    </PageHeader>

    {!isErrors ? <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_70px_rgba(27,46,110,0.09)] ring-1 ring-slate-200/70">
      <div className="flex flex-col gap-5 border-b border-slate-100 bg-gradient-to-r from-teal/[0.045] via-sky-50/70 to-white px-7 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <label className="focus-ring portal-button-primary w-fit cursor-pointer"><Upload className="h-4 w-4" />Choose Files<input className="sr-only" type="file" multiple accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { void selectFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} /></label>
        <p className="text-[13px] text-slate-500">Accepted Format: MS Excel(xlsx)</p>
      </div>
      {notice ? <p className="portal-alert mx-7 mt-7 border-rose-200 bg-rose-50 text-rose-700 sm:mx-10">{notice}</p> : null}
      <div className="p-7 sm:p-10">
        <div className="overflow-hidden rounded-[1.25rem] ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-[13px] text-[#636366]"><strong>Show</strong><select className="h-9 rounded-[9px] border-0 bg-white px-2 ring-1 ring-slate-200"><option>10</option></select><strong>entries</strong></div><label className="text-[13px] font-semibold text-[#3A3A3C]">Search: <input className="portal-input ml-2 w-44" /></label></div>
          <div className="overflow-x-auto"><table className="min-w-full text-left text-[14px]"><thead className="bg-[#F8F8FA]"><tr className="border-b border-[#E5E5EA]"><th className="px-5 py-4">File Name</th><th className="px-5 py-4">DateCreated</th><th className="px-5 py-4">Size(MB)</th><th className="px-5 py-4">Remove</th></tr></thead><tbody>{files.length ? files.map((file) => <tr key={file.id} className="border-b border-[#F2F2F7] transition-colors hover:bg-teal/[0.025]"><td className="px-5 py-5"><div className="flex items-center gap-2"><span className={file.status === "error" ? "text-red-600" : "text-slate-800"}>{file.name}</span>{file.status === "uploading" ? <span className="portal-status bg-sky-50 text-sky-600"><LoaderCircle className="h-3 w-3 animate-spin" />{file.progress}%</span> : null}</div>{file.status === "uploading" ? <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal to-sky-500 transition-all duration-300" style={{ width: `${file.progress}%` }} /></div> : null}{file.message ? <p className="mt-2 text-[11px] text-red-600">{file.message}</p> : null}</td><td className="px-5 py-5">{file.created}</td><td className="px-5 py-5">{file.size}</td><td className="px-5 py-5"><button onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))} className="focus-ring rounded-lg px-2 py-1 text-teal hover:bg-teal/5">Remove</button></td></tr>) : <tr><td colSpan={4} className="px-5 py-20 text-center text-[#8E8E93]">No data available in table</td></tr>}</tbody></table></div>
          <div className="flex flex-col gap-3 border-t border-[#E5E5EA] px-5 py-4 text-[13px] text-[#636366] sm:flex-row sm:items-center sm:justify-between"><span>Showing {files.length ? 1 : 0} to {files.length} of {files.length} entries</span><span>Previous &nbsp; Next</span></div>
        </div>
      </div>
    </section> : <section className="space-y-7"><button onClick={() => void downloadApiFile("/workflows/memo/errors.csv", "memoapp-exceptions.csv").catch((error: Error) => setNotice(error.message))} className="focus-ring portal-button-primary"><Download className="h-4 w-4" />Download Excel File</button><DemoTable ariaLabel="MemoApp errors" headers={memoHeaders} rows={memoErrors} actions={(row) => <button className="focus-ring grid h-10 w-12 place-items-center rounded-[10px] bg-teal/10 text-teal transition hover:bg-teal hover:text-white" aria-label={`Open ${row[0]} line ${row[1]}`}><ExternalLink className="h-4 w-4" /></button>} /></section>}
  </div>;
}
