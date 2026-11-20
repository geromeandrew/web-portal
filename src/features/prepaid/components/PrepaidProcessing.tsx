import { useEffect, useState } from "react";
import type { PrepaidImportStage } from "../../../lib/prepaidApi";
import { Check, LoaderCircle } from "lucide-react";
import {
  elapsedTime,
  extractionStatus,
  workflowLabels,
  type ExtractionProgress,
} from "../../../lib/prepaidProgress";

export type ImportProgress = {
  stage: "queued" | "running" | PrepaidImportStage;
  startedAt?: string;
};

const importStatus = {
  queued: ["Waiting to start", "Your files are saved. The import will start automatically."],
  running: ["Processing your reports", "Waiting for the latest import progress."],
  extracting: ["Extracting your reports", "Your uploaded reports are being read and checked."],
  "refreshing-reference": ["Refreshing SAP reference data", "Extraction is complete. Reference data is being refreshed before layout import."],
  "importing-layouts": ["Preparing your review tables", "The EG and SG layouts are being imported."],
};

/** Waiting screen for server preparation. Upload transfers stay in file rows. */
export function PrepaidProcessing({
  finalizing,
  awsImport,
  startedAt,
  progress,
  now,
  connectionIssue,
  checking,
  onCheck,
}: {
  finalizing: boolean;
  awsImport?: ImportProgress;
  startedAt?: number;
  progress: ExtractionProgress | null;
  now: number;
  connectionIssue: boolean;
  checking: boolean;
  onCheck: () => void;
}) {
  const [importNow, setImportNow] = useState(Date.now);
  const awsStartedAt = awsImport?.startedAt;
  useEffect(() => {
    if (!awsStartedAt) return;
    const timer = setInterval(() => setImportNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [awsStartedAt]);

  const status = extractionStatus(awsImport ? null : progress);
  const stage = awsImport?.stage;
  const publishing = stage ? stage === "importing-layouts" : finalizing || status.finalizing;
  const extracted = publishing || stage === "refreshing-reference";
  const parsed = Date.parse(awsImport ? awsStartedAt ?? "" : progress?.preparation?.created_at ?? "");
  const start = Number.isFinite(parsed) ? parsed : awsImport ? undefined : startedAt;
  const steps = [
    { label: "Upload files", done: true, active: false },
    { label: "Extract reports", done: extracted, active: stage ? stage === "extracting" || stage === "running" : !publishing },
    { label: "Prepare review", done: false, active: extracted },
  ];

  return (
    <div className="pp-processing-dialog">
      <div className="pp-processing-symbol">
        <LoaderCircle size={32} className="pp-spinner" aria-hidden="true" />
      </div>
      <h2>{stage ? importStatus[stage][0] : publishing ? "Preparing your review tables" : "Extracting your reports"}</h2>
      <p className="pp-processing-intro">
        {stage
          ? importStatus[stage][1]
          : publishing
            ? "We are building the EG and SG layouts, allocations and journal vouchers."
            : "Your files are saved. Please wait while your reports are checked and extracted. This can take several minutes."}
      </p>
      <ol className="pp-processing-steps">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={step.done ? "complete" : step.active ? "active" : ""}
            aria-current={step.active ? "step" : undefined}
          >
            <span>{step.done ? <Check size={14} /> : index + 1}</span>
            {step.label}
          </li>
        ))}
      </ol>
      {!awsImport && <div className="pp-processing-status" role="status" aria-live="polite">
        {publishing
          ? "Extraction complete. Loading your review tables…"
          : status.total
            ? `${status.completed} of ${status.total} reports extracted`
            : "Preparing source data…"}
      </div>}
      {status.total > 0 && (
        <div
          className="pp-processing-track"
          role="progressbar"
          aria-label="Reports extracted"
          aria-valuemin={0}
          aria-valuemax={status.total}
          aria-valuenow={status.completed}
        >
          <span
            style={{ width: `${(status.completed / status.total) * 100}%` }}
          />
        </div>
      )}
      <div className="pp-processing-files">
        {status.rows
          .filter((row) => row.status !== "completed")
          .map((row) => (
            <div key={row.workflow} className="pp-processing-file">
              <span>{workflowLabels[row.workflow] ?? "Source report"}</span>
              <span>
                {row.status === "failed"
                  ? "Needs attention"
                  : row.status === "waiting" || row.status === "running"
                    ? "Processing…"
                    : "Waiting"}
              </span>
            </div>
          ))}
      </div>
      {start !== undefined && (
        <p className="pp-processing-elapsed" aria-live="off">
          Preparation elapsed time <strong>{elapsedTime(start, awsImport ? Math.max(importNow, Date.now()) : now)}</strong>
        </p>
      )}
      {connectionIssue && (
        <p className="pp-processing-connection" role="status">
          We could not get the latest status. Processing may still be running on
          the server. We will check again automatically.
        </p>
      )}
      <p className="pp-processing-footnote">
        You can hide this window and switch workspaces while processing continues.
      </p>
      <div className="pp-dialog-actions">
        <button className="pp-outline" disabled={checking} onClick={onCheck}>
          {checking ? "Checking…" : "Check status"}
        </button>
      </div>
    </div>
  );
}
