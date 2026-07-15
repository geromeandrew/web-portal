import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Clipboard, CloudUpload, LoaderCircle, RefreshCcw, Trash2, Upload, Zap } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { uploadFileThroughLambda, requestPresignedUploads, uploadFileWithProgress, validateLambdaFile, validateLocalFiles } from "../lib/uploadClient";
import { applyPresignResponse, toQueueItems, updateQueueItem, type UploadQueueItem } from "../lib/uploadState";
import { useUploadMode } from "../lib/uploadMode";
import { formatBytes } from "../lib/utils";

type WorkflowUploadProps = { title: string; description: string; acceptLabel?: string; multipleDirect?: boolean };

export default function WorkflowUpload({ title, description, acceptLabel = "Supported business files", multipleDirect = true }: WorkflowUploadProps) {
  const { uploadMode } = useUploadMode();
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = items.some((item) => item.status === "requesting" || item.status === "uploading");
  const isLambda = uploadMode === "lambda";
  const successful = useMemo(() => items.filter((item) => item.status === "success").length, [items]);

  const directUpload = async (pending: UploadQueueItem[]) => {
    setItems((current) => current.map((item) => pending.some((candidate) => candidate.id === item.id) ? { ...item, status: "requesting", progress: 4, message: undefined } : item));
    try {
      const response = await requestPresignedUploads(pending);
      const ready = applyPresignResponse(pending, response);
      setItems((current) => current.map((item) => ready.find((candidate) => candidate.id === item.id) ?? item));
      for (const item of ready) {
        if (item.status !== "ready") continue;
        setItems((current) => updateQueueItem(current, item.id, { status: "uploading", progress: 12 }));
        try {
          await uploadFileWithProgress(item, (progress) => setItems((current) => updateQueueItem(current, item.id, { status: "uploading", progress })));
          setItems((current) => updateQueueItem(current, item.id, { status: "success", progress: 100, message: "Stored securely." }));
        } catch (error) {
          setItems((current) => updateQueueItem(current, item.id, { status: "error", progress: 0, message: error instanceof Error ? error.message : "Upload failed." }));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start the transfer.";
      setNotice(message);
      setItems((current) => current.map((item) => pending.some((candidate) => candidate.id === item.id) ? { ...item, status: "error", progress: 0, message } : item));
    }
  };

  const lambdaUpload = async (item: UploadQueueItem) => {
    setItems((current) => updateQueueItem(current, item.id, { status: "uploading", progress: 6, message: undefined }));
    try {
      const response = await uploadFileThroughLambda(item, (progress) => setItems((current) => updateQueueItem(current, item.id, { status: "uploading", progress })));
      setItems((current) => updateQueueItem(current, item.id, { status: "success", progress: 100, objectKey: response.upload.objectKey, message: "Stored securely." }));
    } catch (error) {
      setItems((current) => updateQueueItem(current, item.id, { status: "error", progress: 0, message: error instanceof Error ? error.message : "Lambda upload failed." }));
    }
  };

  const selectFiles = async (files: File[]) => {
    if (!files.length || busy) return;
    setNotice(null);
    if (isLambda) {
      if (files.length > 1) setNotice("Lambda mode accepts one file at a time. The first file was selected.");
      const file = files[0];
      const rejection = validateLambdaFile(file);
      const item: UploadQueueItem = { id: crypto.randomUUID(), file, status: rejection ? "rejected" : "queued", progress: 0, message: rejection ?? undefined, transport: "lambda" };
      setItems((current) => [item, ...current]);
      if (!rejection) await lambdaUpload(item);
      return;
    }
    const { accepted, rejected } = validateLocalFiles(files);
    const next = toQueueItems(accepted).map((item) => ({ ...item, transport: "direct" as const }));
    const rejectedItems: UploadQueueItem[] = rejected.map((entry) => ({ id: crypto.randomUUID(), file: new File([], entry.name), status: "rejected", progress: 0, message: entry.reason, transport: "direct" }));
    setItems((current) => [...next, ...rejectedItems, ...current]);
    if (rejected.length) setNotice(`${rejected.length} file${rejected.length === 1 ? " was" : "s were"} rejected before upload.`);
    if (next.length) await directUpload(next);
  };

  const retry = async (item: UploadQueueItem) => {
    const refreshed = { ...item, status: "queued" as const, progress: 0, message: undefined, objectKey: undefined, uploadUrl: undefined, headers: undefined, expiresAt: undefined };
    if ((item.transport ?? (isLambda ? "lambda" : "direct")) === "lambda") {
      const rejection = validateLambdaFile(item.file);
      if (rejection) { setItems((current) => updateQueueItem(current, item.id, { status: "rejected", message: rejection, progress: 0 })); return; }
      setItems((current) => current.map((candidate) => candidate.id === item.id ? refreshed : candidate));
      await lambdaUpload(refreshed);
    } else {
      setItems((current) => current.map((candidate) => candidate.id === item.id ? refreshed : candidate));
      await directUpload([refreshed]);
    }
  };

  return <section className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-100">
    <div className="flex flex-col gap-4 bg-gradient-to-r from-teal/8 via-sky-50 to-violet-50 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-[12px] font-semibold text-teal">{isLambda ? "Lambda upload" : "Direct S3 upload"}</p><h2 className="font-heading mt-1 text-[20px] font-bold tracking-tight text-slate-900">{title}</h2><p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">{description}</p></div>
      <span className="w-fit rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-teal shadow-sm">{successful} complete</span>
    </div>
    <div className="p-5">
      <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFiles(Array.from(event.dataTransfer.files)); }} className={`flex min-h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${dragging ? "border-teal bg-teal/5" : "border-sky-100 bg-gradient-to-br from-teal/5 via-sky-50 to-violet-50"}`}>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal to-sky-500 text-white shadow-lg shadow-teal/20">{isLambda ? <Zap className="h-5 w-5" /> : <CloudUpload className="h-5 w-5" />}</span>
        <p className="mt-4 text-[15px] font-semibold text-slate-900">{busy ? "Transfer in progress" : isLambda ? "Drop one small file here" : "Drop files here"}</p>
        <p className="mt-1 text-[13px] text-slate-500">{isLambda ? "One file, up to 4 MB, routed through Lambda." : "Choose multiple files for a presigned browser transfer."}</p>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="focus-ring mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-teal to-sky-500 px-5 text-[14px] font-semibold text-white shadow-lg shadow-teal/20 transition hover:-translate-y-0.5 disabled:opacity-50"><Upload className="h-4 w-4" /> Choose {isLambda ? "file" : "files"}</button>
        <p className="mt-3 text-[11px] text-[#8E8E93]">{acceptLabel}</p>
        <input ref={inputRef} type="file" className="hidden" multiple={!isLambda && multipleDirect} onChange={(event) => { void selectFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
      </div>
      {notice ? <div className="mt-4 flex gap-2 border-l-2 border-amber-400 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"><AlertCircle className="h-4 w-4 shrink-0" />{notice}</div> : null}
      <AnimatePresence initial={false}>{items.length ? <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 border-t border-slate-100 pt-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Transfer queue</p><span className="text-xs text-slate-400">{items.length} file{items.length === 1 ? "" : "s"}</span></div><div className="divide-y divide-slate-100">{items.map((item) => <div key={item.id} className="py-3"><div className="flex items-center gap-3"><span className={item.status === "success" ? "text-teal" : item.status === "error" || item.status === "rejected" ? "text-rose-500" : "text-navy"}>{item.status === "success" ? <CheckCircle2 className="h-4 w-4" /> : item.status === "uploading" || item.status === "requesting" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.file.name}</span><span className="hidden text-xs text-slate-400 sm:inline">{formatBytes(item.file.size)}</span>{item.objectKey ? <button className="focus-ring text-slate-500 hover:text-navy" onClick={() => void navigator.clipboard.writeText(item.objectKey ?? "")} aria-label={`Copy object key for ${item.file.name}`}><Clipboard className="h-4 w-4" /></button> : null}{item.status === "error" || item.status === "rejected" ? <button className="focus-ring text-slate-500 hover:text-navy" onClick={() => void retry(item)} aria-label={`Retry ${item.file.name}`}><RefreshCcw className="h-4 w-4" /></button> : null}<button className="focus-ring text-slate-400 hover:text-rose-600" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))} aria-label={`Remove ${item.file.name}`}><Trash2 className="h-4 w-4" /></button></div><div className="mt-2 h-1 overflow-hidden bg-slate-100"><motion.div className={item.status === "error" || item.status === "rejected" ? "h-full bg-rose-400" : "h-full bg-teal"} animate={{ width: `${item.progress}%` }} /></div>{item.message ? <p className="mt-1 text-xs text-slate-500">{item.message}</p> : null}</div>)}</div></motion.div> : null}</AnimatePresence>
    </div>
  </section>;
}
