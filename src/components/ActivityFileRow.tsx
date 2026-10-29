import type { ReactNode } from "react";
import sheetsIcon from "../assets/sheets-icon.svg";

/** Inset file grouping drawn inside the parent table's existing columns. */
export default function ActivityFileRow({
  fileName,
  uploadedBy,
  status,
  action,
  first,
  last,
}: {
  fileName: string;
  uploadedBy: string | null | undefined;
  status: ReactNode;
  action: ReactNode;
  first: boolean;
  last: boolean;
}) {
  return (
    <tr
      className="activity-file-row font-elliot text-[11px] 2xl:text-[13px]"
      data-first={first}
      data-last={last}
    >
      <td className="activity-file-name">
        <span className="relative z-[1] flex min-w-0 items-center gap-2">
          <img src={sheetsIcon} alt="" className="h-3.5 shrink-0" />
          <span className="min-w-0 break-all">{fileName}</span>
        </span>
      </td>
      <td>
        <span className="relative z-[1] break-words">{uploadedBy ?? "-"}</span>
      </td>
      <td>
        <div className="relative z-[1]">{status}</div>
      </td>
      <td className="activity-file-action">
        <div className="relative z-[1]">{action}</div>
      </td>
    </tr>
  );
}
