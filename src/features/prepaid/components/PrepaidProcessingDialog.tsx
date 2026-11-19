import { useCallback } from "react";
import { PrepaidProcessing, type ImportProgress } from "./PrepaidProcessing";
import { PrepaidDialog as Dialog } from "./PrepaidDialog";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

export function PrepaidProcessingDialog({
  workspace,
  awsImport,
  onCheckImport,
  importStatusError,
}: {
  awsImport?: ImportProgress;
  onCheckImport?: () => void;
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
    | "checkingProgress"
    | "checkProcessingStatus"
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
    checkingProgress,
    checkProcessingStatus,
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
        checking={!awsImport && checkingProgress}
        onCheck={onCheckImport ?? checkProcessingStatus}
      />
    </Dialog>
  );
}
