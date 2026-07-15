import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  LoaderCircle,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { formatBytes, formatRelativeExpiry } from "../lib/utils";
import type { UploadQueueItem } from "../lib/uploadState";

type UploadQueueProps = {
  items: UploadQueueItem[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

function statusMeta(item: UploadQueueItem) {
  switch (item.status) {
    case "queued":
      return { icon: Clock3, label: "Queued", tone: "text-slate-500 bg-slate-100" };
    case "requesting":
      return { icon: LoaderCircle, label: "Signing", tone: "text-ocean bg-sky-100" };
    case "ready":
      return { icon: Clock3, label: "Ready", tone: "text-gold bg-amber-100" };
    case "uploading":
      return { icon: LoaderCircle, label: "Uploading", tone: "text-ocean bg-sky-100" };
    case "success":
      return { icon: CheckCircle2, label: "Uploaded", tone: "text-pine bg-emerald-100" };
    case "rejected":
      return { icon: AlertCircle, label: "Rejected", tone: "text-coral bg-rose-100" };
    default:
      return { icon: AlertCircle, label: "Error", tone: "text-coral bg-rose-100" };
  }
}

export default function UploadQueue({ items, onRemove, onRetry }: UploadQueueProps) {
  const uploadedCount = items.filter((item) => item.status === "success").length;

  return (
    <section className="rounded-[30px] border border-white/70 bg-white/82 p-5 shadow-[0_20px_60px_rgba(15,23,32,0.06)] backdrop-blur-xl md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Queue</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-900">
            {uploadedCount} of {items.length} uploaded
          </h2>
        </div>
        {items.length > 0 ? (
          <div className="rounded-full border border-black/5 bg-slate-50/80 px-3 py-1.5 text-sm text-slate-500">
            {items.length} file{items.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
            No files queued yet.
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {items.map((item) => {
            const meta = statusMeta(item);
            const StatusIcon = meta.icon;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.985 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-slate-200/80 bg-white/72 p-4 shadow-[0_10px_30px_rgba(15,23,32,0.03)]"
              >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.file.name}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${meta.tone}`}>
                      <StatusIcon className={`h-3.5 w-3.5 ${item.status === "uploading" || item.status === "requesting" ? "animate-spin" : ""}`} />
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-400">{formatBytes(item.file.size)}</span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/90">
                    <motion.div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#0f1720,#475569)]"
                      style={{ width: `${item.progress}%` }}
                      transition={{ duration: 0.32, ease: "easeOut" }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                    {item.objectKey ? <span>Key: {item.objectKey}</span> : null}
                    {item.expiresAt && item.status !== "success" ? (
                      <span>Expires in {formatRelativeExpiry(item.expiresAt)}</span>
                    ) : null}
                    {item.message ? <span>{item.message}</span> : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.objectKey ? (
                    <button
                      type="button"
                      className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                      onClick={() => navigator.clipboard.writeText(item.objectKey ?? "")}
                      aria-label={`Copy object key for ${item.file.name}`}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  ) : null}

                  {item.status === "error" || item.status === "rejected" ? (
                    <button
                      type="button"
                      className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                      onClick={() => onRetry(item.id)}
                      aria-label={`Retry ${item.file.name}`}
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remove ${item.file.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
