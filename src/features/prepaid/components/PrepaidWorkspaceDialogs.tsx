import { Check, LoaderCircle } from "lucide-react";
import { PrepaidDialog as Dialog } from "./PrepaidDialog";
import { PrepaidReportHistory } from "./PrepaidReportHistory";
import { PrepaidAllocationBreakdown } from "./PrepaidAllocationBreakdown";
import { PrepaidActionNotice } from "./PrepaidActionNotice";
import { PrepaidProcessingDialog } from "./PrepaidProcessingDialog";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

export function PrepaidWorkspaceDialogs({
  workspace,
}: {
  workspace: PrepaidWorkspaceController;
}) {
  const {
    processing,
    modal,
    close,
    busy,
    error,
    removal,
    pending,
    uploading,
    awsBatchActive,
    awsBatchResetAllowed,
    removeFile,
    removing,
    reset,
    resetting,
  } = workspace;
  const removeReason = awsBatchActive && awsBatchResetAllowed
    ? "Reset the workspace before removing files from this batch."
    : pending || awsBatchActive ? "Wait for processing to finish before removing files."
    : uploading ? "Finish or cancel uploads before removing files." : "";
  const resetBlocked = pending || (awsBatchActive && !awsBatchResetAllowed) || uploading;
  return (
    <>
      <PrepaidProcessingDialog workspace={workspace} />
      {!processing && modal && (
        <Dialog
          key={modal}
          title={
            modal === "history"
              ? "Prepaid Re-Class History"
              : modal === "breakdown"
                ? "Allocation breakdown"
                : modal === "remove"
                  ? "Remove uploaded file"
                  : "Reset workspace"
          }
          onClose={close}
          wide={modal === "breakdown"}
          busy={busy}
        >
          {error && (
            <div className="pp-error" role="alert">
              {error}
            </div>
          )}
          {modal === "remove" ? (
            <div className="pp-reset-dialog">
              <div className="pp-question">?</div>
              <h2>Remove this file from the workspace?</h2>
              <p className="pp-removal-name">{removal?.original_name}</p>
              <p>
                The file will no longer be used in this workspace. Its original
                stored copy and saved reports are retained.
              </p>
              {removeReason && <PrepaidActionNotice id="prepaid-remove-blocked">{removeReason}</PrepaidActionNotice>}
              <div className="pp-actions">
                <button className="pp-outline" disabled={busy} onClick={close}>
                  No, keep file
                </button>
                <button
                  className="pp-primary"
                  disabled={busy || !!removeReason}
                  aria-describedby={removeReason ? "prepaid-remove-blocked" : undefined}
                  onClick={removeFile}
                  aria-busy={!!removing}
                >
                  {removing ? (
                    <>
                      <LoaderCircle
                        size={16}
                        className="pp-spinner"
                        aria-hidden="true"
                      />{" "}
                      Removing…
                    </>
                  ) : (
                    "Yes, remove"
                  )}
                </button>
              </div>
            </div>
          ) : modal === "reset" ? (
            <div className="pp-reset-dialog">
              <div className="pp-question">?</div>
              <h2>Are you sure you want to reset the workspace?</h2>
              <p>
                Resetting the workspace will remove all your progress.
                <br />
                All saved reports can be viewed in History.
              </p>
              <div className="pp-actions">
                <button className="pp-outline" disabled={busy} onClick={close}>
                  No, go back
                </button>
                <button
                  className="pp-primary"
                  disabled={busy || resetBlocked}
                  onClick={reset}
                  aria-busy={resetting}
                >
                  {resetting ? (
                    <>
                      <LoaderCircle
                        size={16}
                        className="pp-spinner"
                        aria-hidden="true"
                      />{" "}
                      Resetting…
                    </>
                  ) : (
                    "Yes, reset"
                  )}
                </button>
              </div>
            </div>
          ) : modal === "reset-success" ? (
            <div className="pp-reset-dialog">
              <div className="pp-success-icon">
                <Check size={54} />
              </div>
              <h2>Workspace reset</h2>
              <p>To start with re-classification, upload your source files</p>
              <button className="pp-primary" onClick={close}>
                Okay, got it
              </button>
            </div>
          ) : modal === "history" ? (
            <PrepaidReportHistory workspace={workspace} />
          ) : (
            <PrepaidAllocationBreakdown workspace={workspace} />
          )}
        </Dialog>
      )}
    </>
  );
}
