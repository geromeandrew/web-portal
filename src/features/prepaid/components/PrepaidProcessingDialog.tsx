import { useCallback } from "react";
import { PrepaidProcessing } from "./PrepaidProcessing";
import { PrepaidDialog as Dialog } from "./PrepaidDialog";
import { PrepaidProgressStrip } from "./PrepaidProgressStrip";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

export function PrepaidProcessingDialog({
  workspace,
}: {
  workspace: Pick<
    PrepaidWorkspaceController,
    | "processing"
    | "progressHidden"
    | "setProgressHidden"
    | "hydratingReview"
    | "uploadStartedAt"
    | "progress"
    | "progressNow"
    | "progressError"
  >;
}) {
  const {
    processing,
    progressHidden,
    setProgressHidden,
    hydratingReview,
    uploadStartedAt,
    progress,
    progressNow,
    progressError,
  } = workspace;
  const hideProgress = useCallback(() => setProgressHidden(true), [setProgressHidden]);
  if (!processing) return null;
  return (
    <>
      <PrepaidProgressStrip
        state="active"
        title={hydratingReview ? "Preparing your review tables" : "Extracting your reports"}
        detail={progressError ? "Reconnecting to check progress." : undefined}
        action="View progress"
        onAction={() => setProgressHidden(false)}
      />
      {!progressHidden && (
        <Dialog title="Prepaid processing progress" onClose={hideProgress} minimize>
          <PrepaidProcessing
            finalizing={hydratingReview}
            startedAt={uploadStartedAt}
            progress={progress}
            now={progressNow}
            connectionIssue={!!progressError}
          />
        </Dialog>
      )}
    </>
  );
}
