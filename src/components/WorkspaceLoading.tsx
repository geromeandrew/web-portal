import { LoaderCircle } from "lucide-react";

export function WorkspaceLoading({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 font-elliot text-[11px] text-[#69717d] 2xl:text-[13px] ${compact ? "py-3" : "min-h-[200px] px-6 py-10"}`}
    >
      <LoaderCircle
        aria-hidden="true"
        className="h-4 w-4 shrink-0 animate-spin text-[#087dca] motion-reduce:animate-none"
      />
      <span>{label}</span>
    </div>
  );
}
