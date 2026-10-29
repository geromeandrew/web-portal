import { formatBillCycleUploadTimestamp } from "../lib/billCycleWorkspace";

/** Shared with Bill Cycle so every pipeline uses the same icon and timestamp. */
export function UploadStatus({
  readAt,
  present = true,
}: {
  readAt: string | null;
  present?: boolean;
}) {
  return present ? (
    <span className="font-medium text-[#17ad6b]">
      <span>✓ Read</span>
      <small className="block whitespace-normal font-normal leading-4 text-[#4165a8]">
        {formatBillCycleUploadTimestamp(readAt)}
      </small>
    </span>
  ) : (
    <span className="text-[#8b96a6]">-</span>
  );
}

/** Every file has its own filename, uploader, status and action columns. */
export function ActivityColumns() {
  return (
    <colgroup>
      <col className="w-[44%]" />
      <col className="w-[24%]" />
      <col className="w-[24%]" />
      <col className="w-[8%]" />
    </colgroup>
  );
}
