import { Download, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { downloadApiFile } from "../../../lib/apiClient";
import type { PrepaidBatchStatus } from "../../../lib/prepaidApi";
import { PrepaidActionNotice } from "./PrepaidActionNotice";

export function PrepaidReportsPanel({ batch }: { batch?: PrepaidBatchStatus | null }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const available = batch?.amaxeeReportAvailable === true;

  async function download() {
    if (!batch || !available || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const startedAt = batch.executions.import?.startedAt;
      const timestamp = startedAt ? new Date(startedAt) : null;
      const date = timestamp && !Number.isNaN(timestamp.getTime())
        ? `_${timestamp.toISOString().slice(0, 10)}`
        : "";
      await downloadApiFile(
        `/workflows/prepaid/aws-batch/${batch.id}/reports/amaxee.xlsx`,
        `AMAXEE${date}.xlsx`,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not download AMAXEE.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="pp-review" aria-labelledby="prepaid-reports-heading">
      <div className="pp-panel-heading">
        <h2 id="prepaid-reports-heading">Reports</h2>
      </div>
      <div className="pp-review-content">
        {error && <PrepaidActionNotice tone="error">{error}</PrepaidActionNotice>}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#d6e1ed] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#edf5fc] text-[#087dca]">
              <FileSpreadsheet size={18} aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-bold">AMAXEE Report</h3>
              {!available && (
                <p className="mt-1 text-[#536e91]">
                  Available after a 308 or 318 billing report is processed.
                </p>
              )}
            </div>
          </div>
          {available && (
            <button type="button" className="pp-outline" aria-busy={downloading}
              disabled={downloading} onClick={() => void download()}>
              {downloading
                ? <LoaderCircle size={16} className="pp-spinner" aria-hidden="true" />
                : <Download size={16} aria-hidden="true" />}
              {downloading ? "Downloading..." : "Download AMAXEE"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
