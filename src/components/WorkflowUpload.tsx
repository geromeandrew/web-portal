import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Clipboard, LoaderCircle, RefreshCcw, Trash2, Upload, Zap } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { uploadFileThroughApi, validateUploadFile } from "../lib/uploadClient";
import { createUploadId } from "../lib/uploadId";
import { updateQueueItem, type UploadQueueItem } from "../lib/uploadState";
import { formatBytes } from "../lib/utils";

type WorkflowUploadProps = { title: string; description: string; acceptLabel?: string };

export default function WorkflowUpload({ title, description, acceptLabel = "Supported business files" }: WorkflowUploadProps) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = items.some((item) => item.status === "uploading");
  const successful = useMemo(() => items.filter((item) => item.status === "success").length, [items]);

  const apiUpload = async (item: UploadQueueItem) => {
    setItems((current) => updateQueueItem(current, item.id, { status: "uploading", progress: 6, message: undefined }));
    try {
      const response = await uploadFileThroughApi(item, "aprm", (progress) => setItems((current) => updateQueueItem(current, item.id, { status: "uploading", progress })));
      setItems((current) => updateQueueItem(current, item.id, { status: "success", progress: 100, objectKey: response.upload.objectKey, message: "Stored securely." }));
    } catch (error) {
      setItems((current) => updateQueueItem(current, item.id, { status: "error", progress: 0, message: error instanceof Error ? error.message : "API upload failed." }));
    }
  };

  const selectFiles = async (files: File[]) => {
    if (!files.length || busy) return;
    setNotice(files.length > 1 ? "This workflow uploads one file at a time. The first file was selected." : null);
    const file = files[0];
    const rejection = validateUploadFile(file);
    const item: UploadQueueItem = { id: createUploadId(), file, status: rejection ? "rejected" : "queued", progress: 0, message: rejection ?? undefined };
    setItems((current) => [item, ...current]);
    if (!rejection) await apiUpload(item);
  };

  const retry = async (item: UploadQueueItem) => {
    const rejection = validateUploadFile(item.file);
    if (rejection) {
      setItems((current) => updateQueueItem(current, item.id, { status: "rejected", message: rejection, progress: 0 }));
      return;
    }
    const refreshed = { ...item, status: "queued" as const, progress: 0, message: undefined, objectKey: undefined };
    setItems((current) => current.map((candidate) => candidate.id === item.id ? refreshed : candidate));
    await apiUpload(refreshed);
  };

  return <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_70px_rgba(27,46,110,0.09)] ring-1 ring-slate-200/70">
    <div className="flex flex-col gap-6 border-b border-slate-100 bg-gradient-to-r from-teal/[0.07] via-sky-50/80 to-violet-50/70 px-7 py-8 sm:px-10 sm:py-10 lg:flex-row lg:items-start lg:justify-between">
      <div><p className="text-[12px] font-semibold text-teal">Secure API upload</p><h2 className="font-heading mt-2 text-[24px] font-bold tracking-tight text-slate-900">{title}</h2><p className="mt-3 max-w-2xl text-[14px] leading-7 text-slate-500">{description}</p></div>
      <span className="portal-status w-fit bg-white px-3.5 py-2 text-teal shadow-sm ring-1 ring-teal/10">{successful} complete</span>
    </div>

    <div className="p-7 sm:p-10">
      <motion.div layout onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFiles(Array.from(event.dataTransfer.files)); }} className={`flex min-h-[340px] flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed px-7 py-12 text-center transition duration-200 sm:min-h-[390px] ${dragging ? "scale-[1.005] border-teal bg-teal/[0.06]" : "border-sky-100 bg-gradient-to-br from-teal/[0.035] via-sky-50/70 to-violet-50/60"}`}>
        <motion.span animate={dragging ? { y: -5, scale: 1.06 } : { y: 0, scale: 1 }} className="grid h-16 w-16 place-items-center rounded-[1.25rem] bg-gradient-to-br from-teal to-sky-500 text-white shadow-[0_14px_32px_rgba(21,153,160,.25)]"><Zap className="h-6 w-6" /></motion.span>
        <p className="mt-7 text-[17px] font-semibold text-slate-900">{busy ? "Transfer in progress" : "Drop one small file here"}</p>
        <p className="mt-2 text-[13px] leading-6 text-slate-500">One file, up to 4 MB, routed through the secure portal API.</p>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="focus-ring portal-button-primary mt-6 rounded-full px-6"><Upload className="h-4 w-4" />Choose file</button>
        <p className="mt-4 text-[11px] text-[#8E8E93]">{acceptLabel}</p>
        <input ref={inputRef} type="file" className="hidden" onChange={(event) => { void selectFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
      </motion.div>

      {notice ? <div className="portal-alert mt-6 border-amber-200 bg-amber-50 text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div> : null}

      <AnimatePresence initial={false}>{items.length ? <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-9 border-t border-slate-100 pt-7"><div className="mb-4 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Transfer queue</p><span className="text-xs text-slate-400">{items.length} file{items.length === 1 ? "" : "s"}</span></div><div className="divide-y divide-slate-100">{items.map((item) => <div key={item.id} className="py-5"><div className="flex items-center gap-3"><span className={item.status === "success" ? "text-teal" : item.status === "error" || item.status === "rejected" ? "text-rose-500" : "text-navy"}>{item.status === "success" ? <CheckCircle2 className="h-4 w-4" /> : item.status === "uploading" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.file.name}</span><span className="hidden text-xs text-slate-400 sm:inline">{formatBytes(item.file.size)}</span>{item.objectKey ? <button className="focus-ring rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy" onClick={() => void navigator.clipboard.writeText(item.objectKey ?? "")} aria-label={`Copy object key for ${item.file.name}`}><Clipboard className="h-4 w-4" /></button> : null}{item.status === "error" || item.status === "rejected" ? <button className="focus-ring rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy" onClick={() => void retry(item)} aria-label={`Retry ${item.file.name}`}><RefreshCcw className="h-4 w-4" /></button> : null}<button className="focus-ring rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))} aria-label={`Remove ${item.file.name}`}><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><motion.div className={item.status === "error" || item.status === "rejected" ? "h-full rounded-full bg-rose-400" : "h-full rounded-full bg-teal"} animate={{ width: `${item.progress}%` }} /></div>{item.message ? <p className="mt-2 text-xs text-slate-500">{item.message}</p> : null}</div>)}</div></motion.div> : null}</AnimatePresence>
    </div>
  </section>;
}
