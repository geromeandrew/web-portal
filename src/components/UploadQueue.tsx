import {
  AlertCircle,
  CheckCircle2,
  FileText,
  LoaderCircle,
} from "lucide-react";
import type { UploadProgress } from "../lib/useUploadProgress";

export default function UploadQueue({
  progress,
  onCancel,
}: {
  progress: UploadProgress;
  onCancel?: () => void;
}) {
  const completed = progress.entries.filter(
    (entry) => entry.status === "uploaded",
  ).length;
  const total = progress.entries.length;
  const summary =
    progress.phase === "preparing"
      ? "Preparing upload…"
      : progress.phase === "refreshing"
        ? "Updating activity…"
        : progress.phase === "complete"
          ? `${total} file${total === 1 ? "" : "s"} successfully uploaded`
          : progress.phase === "error"
            ? `${completed} of ${total} files confirmed uploaded`
            : `Uploading ${Math.min(completed + 1, total)} of ${total} files`;
  return (
    <section
      aria-label="Upload progress"
      className="overflow-hidden rounded-[8px] bg-white shadow-sm ring-1 ring-[#e0e8f2]"
    >
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <p
          role="status"
          className="flex items-center gap-2 font-elliot text-[12px] font-semibold text-[#171b24]"
        >
          {progress.phase === "complete" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#17ad6b]" />
          ) : progress.phase === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          ) : (
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-[#087dca]" />
          )}
          {summary}
        </p>
        {onCancel && ["preparing", "uploading"].includes(progress.phase) ? (
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring shrink-0 rounded px-2 py-1 text-[12px] text-[#087dca]"
          >
            Cancel upload
          </button>
        ) : null}
      </div>
      {progress.error ? (
        <p
          role="alert"
          className="px-5 pb-3 text-[12px] leading-5 text-rose-600"
        >
          {progress.error}
        </p>
      ) : null}
      {progress.phase === "preparing" || progress.phase === "uploading" ? (
        <p className="px-5 pb-2 text-[11px] text-slate-500">
          Progress is estimated until each file is saved.
        </p>
      ) : null}
      <ul className="divide-y divide-[#e6ebf2] border-t border-[#e6ebf2]">
        {progress.entries.map((entry) => (
          <li
            key={entry.fileName}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_132px_90px]"
          >
            <span className="col-span-2 flex min-w-0 items-start gap-2 font-elliot text-[11px] text-[#1f2937] sm:col-span-1 2xl:text-[13px]">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16b36f]" />
              <span className="break-all">{entry.fileName}</span>
            </span>
            <div
              role="progressbar"
              aria-label={`Upload ${entry.fileName}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={entry.percent}
              className="h-[5px] overflow-hidden rounded-full bg-[#edf0f3]"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${entry.status === "uploaded" ? "bg-[#17ad6b]" : entry.status === "unconfirmed" ? "bg-rose-400" : "bg-[#1399eb]"}`}
                style={{ width: `${entry.percent}%` }}
              />
            </div>
            <span
              className={`text-right font-elliot text-[11px] ${entry.status === "uploaded" ? "text-[#17ad6b]" : "text-slate-500"}`}
            >
              {entry.status === "uploaded"
                ? "100% · Uploaded"
                : entry.status === "queued"
                  ? "Waiting"
                  : entry.status === "not-started"
                    ? "Not started"
                    : entry.status === "unconfirmed"
                      ? "Not confirmed"
                      : `${entry.percent}%`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
