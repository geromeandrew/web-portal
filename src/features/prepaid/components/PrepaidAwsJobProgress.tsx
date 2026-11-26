import { useCallback, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { PrepaidDialog as Dialog } from "./PrepaidDialog";
import { PrepaidProcessing, importStatus, type ImportProgress } from "./PrepaidProcessing";
import { PrepaidProgressStrip } from "./PrepaidProgressStrip";

export function PrepaidAwsJobProgress({
  phase, state, importProgress, submitting, queued, reconnecting, message,
  expanded, setExpanded, onComplete,
}: {
  phase: "import" | "eg" | "sg";
  state: "active" | "complete" | "failed";
  importProgress: ImportProgress;
  submitting: boolean;
  queued: boolean;
  reconnecting: boolean;
  message?: string | null;
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  onComplete: () => void;
}) {
  const [viewError, setViewError] = useState(false);
  const minimize = useCallback(() => setExpanded(false), [setExpanded]);
  const closeError = useCallback(() => setViewError(false), []);
  const importing = phase === "import";
  const side = phase.toUpperCase();
  const freezeTitle = `Freezing ${side} layout`;
  const title = state === "active"
    ? importing ? importStatus[importProgress.stage][0] : freezeTitle
    : state === "complete"
      ? importing ? "Import complete" : `${side} layout frozen`
      : importing ? "Import failed" : `${side} freeze failed`;
  const freezeDetail = submitting ? "Submitting the freeze request."
    : queued ? "Waiting to start." : "Preparing and delivering the journal.";
  const detail = state === "active"
    ? reconnecting ? "Reconnecting to check progress."
      : importing ? importStatus[importProgress.stage][1] : freezeDetail
    : state === "complete"
      ? importing ? "The EG and SG layouts are ready for review." : "The journal was delivered."
      : message || "Processing needs attention.";
  const action = state === "active" ? "View progress"
    : state === "failed" ? "View error" : importing ? "Open review" : "View journal";

  return (
    <>
      <PrepaidProgressStrip state={state} title={title} detail={detail} action={action}
        onAction={state === "active" ? () => setExpanded(true)
          : state === "failed" ? () => setViewError(true) : onComplete}
      />
      {state === "active" && expanded && (
        <Dialog title={importing ? "Prepaid processing progress" : freezeTitle} onClose={minimize} minimize compact={!importing}>
          {importing ? (
            <PrepaidProcessing finalizing={false} awsImport={importProgress}
              progress={null} now={0} connectionIssue={reconnecting}
            />
          ) : (
            <div className="pp-processing-dialog">
              <div className="pp-processing-symbol">
                <LoaderCircle size={28} className="pp-spinner" aria-hidden="true" />
              </div>
              <h2>{freezeTitle}</h2>
              <p className="pp-processing-intro">{freezeDetail}</p>
              {reconnecting && <p className="pp-processing-connection" role="status">Connection interrupted. Checking again automatically.</p>}
              {!submitting && <p className="pp-processing-footnote">You can minimize this window or close the tab while processing continues.</p>}
            </div>
          )}
        </Dialog>
      )}
      {state === "failed" && viewError && (
        <Dialog title={title} onClose={closeError} compact>
          <div className="pp-processing-dialog">
            <h2>{title}</h2>
            <p className="pp-processing-intro">{message || "Processing did not complete. Contact support if the issue persists."}</p>
          </div>
        </Dialog>
      )}
    </>
  );
}
