import { useCallback } from "react";
import { PrepaidProcessing, type ImportProgress } from "./PrepaidProcessing";
import { PrepaidDialog as Dialog } from "./PrepaidDialog";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

export function PrepaidProcessingDialog({
  workspace,
  awsImport,
  importStatusError,
}: {
  awsImport?: ImportProgress;
  importStatusError?: boolean;
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
  if (!processing && !awsImport) return null;
  if (progressHidden) {
    return (
      <button type="button" className="pp-link" onClick={() => setProgressHidden(false)}>
        View processing progress
      </button>
    );
  }
  return (
    <Dialog title="Prepaid processing progress" onClose={hideProgress} closeLabel="Hide progress">
      <PrepaidProcessing
        finalizing={hydratingReview}
        awsImport={awsImport}
        startedAt={uploadStartedAt}
        progress={progress}
        now={progressNow}
        connectionIssue={awsImport ? !!importStatusError : !!progressError}
      />
    </Dialog>
  );
}
