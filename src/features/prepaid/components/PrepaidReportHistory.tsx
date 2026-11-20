import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { WorkspaceLoading } from "../../../components/WorkspaceLoading";
import { dateOnly } from "../presentation";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

export function PrepaidReportHistory({
  workspace,
}: {
  workspace: Pick<
    PrepaidWorkspaceController,
    | "busy"
    | "historyDate"
    | "setHistoryLoading"
    | "setHistoryError"
    | "setHistoryDate"
    | "setHistoryOffset"
    | "historyLoading"
    | "historyError"
    | "reports"
    | "download"
    | "setHistoryAttempt"
    | "historyOffset"
    | "hasMore"
  >;
}) {
  const {
    busy,
    historyDate,
    setHistoryLoading,
    setHistoryError,
    setHistoryDate,
    setHistoryOffset,
    historyLoading,
    historyError,
    reports,
    download,
    setHistoryAttempt,
    historyOffset,
    hasMore,
  } = workspace;
  const [downloading, setDownloading] = useState<string>();
  const startDownload = async (path: string, filename: string) => {
    if (busy || downloading) return;
    setDownloading(path);
    try {
      await download(path, filename);
    } finally {
      setDownloading(undefined);
    }
  };
  return (
    <>
      <div className="pp-history">
        <h2>Prepaid Re-Class History</h2>
        <label className="pp-filter">
          Filter{" "}
          <input
            aria-label="Filter report upload date"
            type="date"
            value={historyDate}
            onChange={(e) => {
              setHistoryLoading(true);
              setHistoryError("");
              setHistoryDate(e.target.value);
              setHistoryOffset(0);
            }}
          />
        </label>
        <table className="pp-table">
          <thead>
            <tr>
              <th>DATE OF UPLOAD</th>
              <th>UPLOADED BY</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {(historyLoading || historyError ? [] : reports).map((report) => {
              const actions = report.journals?.length
                ? report.journals.map(({ region, filename }) => ({
                    path: "/aws-batch/" + report.snapshot_id + "/journal/" + region,
                    filename,
                    label: region.toUpperCase() + " JV",
                  }))
                : [{
                    path: "/runs/" + report.run_id + "/reports/" + report.snapshot_id + ".zip",
                    filename: "prepaid-" + report.period + "-reports.zip",
                    label: "reports",
                  }];

              return (
                <tr key={report.snapshot_id}>
                  <td>{dateOnly(report.uploaded_at)}</td>
                  <td>{report.uploaded_by}</td>
                  <td>
                    <div className="pp-history-actions">
                      {actions.map(({ path, filename, label }) => {
                        const active = downloading === path;
                        return (
                          <button
                            key={path}
                            type="button"
                            className="pp-link"
                            disabled={busy || !!downloading}
                            aria-busy={active}
                            onClick={() => void startDownload(path, filename)}
                          >
                            {active && <LoaderCircle size={14} className="pp-spinner" aria-hidden="true" />}
                            {active ? "Downloading " + label + "..." : "Download " + label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {historyLoading ? (
          <WorkspaceLoading label="Loading saved reports..." />
        ) : historyError ? (
          <p className="pp-empty-data" role="alert">
            We could not load your saved reports.{" "}
            <button
              className="pp-link"
              onClick={() => {
                setHistoryLoading(true);
                setHistoryError("");
                setHistoryAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </p>
        ) : (
          !reports.length && (
            <p className="pp-empty-data">
              No saved report snapshots for this date.
            </p>
          )
        )}
        {(historyOffset > 0 || hasMore) && (
          <div className="pp-pagination">
            <button
              disabled={historyLoading || historyOffset === 0}
              onClick={() => {
                setHistoryLoading(true);
                setHistoryOffset((p) => p - 25);
              }}
            >
              Previous
            </button>
            <button
              disabled={historyLoading || !hasMore}
              onClick={() => {
                setHistoryLoading(true);
                setHistoryOffset((p) => p + 25);
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
