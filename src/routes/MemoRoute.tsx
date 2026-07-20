import { Download, ExternalLink, LoaderCircle, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import DemoTable from "../components/DemoTable";
import PageHeader from "../components/PageHeader";
import { memoErrors, memoHeaders } from "../lib/demoData";
import { uploadSingleFile, validateWorkflowFile } from "../lib/uploadClient";
import { createUploadId } from "../lib/uploadId";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type MemoFile = { id: string; name: string; status: "uploading" | "success" | "error"; progress: number; created: string; size: string; message?: string };

function exportErrors() {
  const content = [memoHeaders.join(","), ...memoErrors.map((row) => row.join(","))].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  link.download = "memoapp-exceptions.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function MemoRoute() {
  const { section = "file-upload" } = useParams();
  const [files, setFiles] = useState<MemoFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const isErrors = section === "error-page";

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
        await uploadSingleFile(file, (progress) => setFiles((current) => current.map((item) => item.id === id ? { ...item, progress } : item)));
        setFiles((current) => current.map((item) => item.id === id ? { ...item, status: "success", progress: 100 } : item));
      } catch (error) {
        setFiles((current) => current.map((item) => item.id === id ? { ...item, status: "error", progress: 0, message: error instanceof Error ? error.message : "Upload failed." } : item));
      }
    }));
  };

  return <div className="space-y-5">
    <PageHeader eyebrow="MemoApp SST" title={`MemoApp Standard Source Template — ${isErrors ? "Error Page" : "File Upload"}`} description={isErrors ? "Review and export records that require attention." : "Upload standard source templates and monitor their transfer status."}>
      <nav className="portal-tabs" aria-label="MemoApp navigation"><Link to="/memo/file-upload" className={`portal-tab ${!isErrors ? "portal-tab-active" : ""}`}>File Upload</Link><Link to="/memo/error-page" className={`portal-tab ${isErrors ? "portal-tab-active" : ""}`}>Error Page</Link></nav>
    </PageHeader>

    {!isErrors ? <section>
      <section className="portal-panel p-5"><label className="focus-ring portal-button-primary cursor-pointer"><Upload className="h-4 w-4" />Choose Files<input className="sr-only" type="file" multiple accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { void selectFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} /></label>
      <p className="mt-3 text-[13px] text-slate-500">Accepted Format: MS Excel(xlsx)</p>
      {notice ? <p className="mt-2 text-[13px] text-red-600">{notice}</p> : null}
      <div className="mt-7 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]"><div className="flex items-center justify-between border-b border-[#E5E5EA] px-4 py-3"><div className="flex items-center gap-2 text-[13px] text-[#636366]"><strong>Show</strong><select className="h-8 rounded-[8px] border-0 bg-[#F2F2F7] px-2"><option>10</option></select><strong>entries</strong></div><label className="text-[13px] font-semibold text-[#3A3A3C]">Search: <input className="portal-input ml-2 w-40" /></label></div><table className="min-w-full text-left text-[14px]"><thead className="bg-[#F8F8FA]"><tr className="border-b border-[#E5E5EA]"><th className="px-4 py-3">File Name</th><th className="px-4 py-3">DateCreated</th><th className="px-4 py-3">Size(MB)</th><th className="px-4 py-3">Remove</th></tr></thead><tbody>{files.length ? files.map((file) => <tr key={file.id} className="border-b border-[#F2F2F7] transition-colors hover:bg-teal/[0.025]"><td className="px-4 py-3"><div className="flex items-center gap-2"><span className={file.status === "error" ? "text-red-600" : "text-slate-800"}>{file.name}</span>{file.status === "uploading" ? <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-600"><LoaderCircle className="h-3 w-3 animate-spin" />{file.progress}%</span> : null}</div>{file.status === "uploading" ? <div className="mt-2 h-1 w-44 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal to-sky-500 transition-all duration-300" style={{ width: `${file.progress}%` }} /></div> : null}{file.message ? <p className="mt-1 text-[11px] text-red-600">{file.message}</p> : null}</td><td className="px-4 py-3">{file.created}</td><td className="px-4 py-3">{file.size}</td><td className="px-4 py-3"><button onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))} className="text-teal hover:underline">Remove</button></td></tr>) : <tr><td colSpan={4} className="px-3 py-10 text-center text-[#8E8E93]">No data available in table</td></tr>}</tbody></table><div className="flex items-center justify-between border-t border-[#E5E5EA] px-4 py-3 text-[13px] text-[#636366]"><span>Showing {files.length ? 1 : 0} to {files.length} of {files.length} entries</span><span>Previous &nbsp; Next</span></div></div></section>
    </section> : <section><button onClick={exportErrors} className="focus-ring portal-button-primary"><Download className="h-4 w-4" />Download Excel File</button><div className="mt-4"><DemoTable ariaLabel="MemoApp errors" headers={memoHeaders} rows={memoErrors} actions={(row) => <button className="focus-ring grid h-9 w-12 place-items-center rounded-[9px] bg-teal/10 text-teal transition hover:bg-teal hover:text-white" aria-label={`Open ${row[0]} line ${row[1]}`}><ExternalLink className="h-4 w-4" /></button>} /></div></section>}
  </div>;
}
