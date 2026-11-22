import { Check, LoaderCircle, RefreshCw, X } from "lucide-react";
import { WorkspaceLoading } from "../../../components/WorkspaceLoading";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

export function PrepaidWorkspaceStatus({
  workspace,
}: {
  workspace: Pick<
    PrepaidWorkspaceController,
    | "stage"
    | "layouts"
    | "session"
    | "sources"
    | "run"
    | "loading"
    | "busy"
    | "uploading"
    | "pending"
    | "awsBatchActive"
    | "awsBatchEnabled"
    | "awsBatchReviewReady"
    | "canStartProcessing"
    | "awsBatchResetAllowed"
    | "resetting"
    | "error"
    | "notice"
    | "selectStage"
    | "requestReset"
    | "dismissMessage"
  >;
}) {
  const {
    stage,
    layouts,
    session,
    sources,
    run,
    loading,
    busy,
    uploading,
    pending,
    awsBatchActive,
    awsBatchEnabled,
    awsBatchReviewReady,
    canStartProcessing,
    awsBatchResetAllowed,
    resetting,
    error,
    notice,
    selectStage,
    requestReset,
    dismissMessage,
  } = workspace;
  const canOpenStep2 = awsBatchEnabled
    ? awsBatchReviewReady || canStartProcessing
    : (layouts.eg?.imported && layouts.sg?.imported) || (session?.status === "failed" && sources?.valid);
  return (
    <>
      <div className="pp-workflow">
        <ol className="pp-stepper" aria-label="Workflow stages">
          {([1, 2] as const).map((step) => (
            <li key={step}>
              <button
                className={`pp-step ${stage === step ? "active" : stage > step ? "complete" : ""}`}
                disabled={busy || (step === 2 && !canOpenStep2)}
                aria-label={step === 1 ? "Step 1: Upload file" : "Step 2: Edit & validate"}
                aria-current={stage === step ? "step" : undefined}
                onClick={() => selectStage(step)}
              >
                {stage > step ? <Check size={20} /> : step}
              </button>
              <span className={stage === step ? "pp-current" : ""}>
                {step === 1 ? "Upload file" : "Edit & validate"}
              </span>
            </li>
          ))}
        </ol>
        <button
          className="pp-link pp-reset"
          disabled={
            (!run && !session) || loading || busy || uploading || pending ||
            (awsBatchActive && !awsBatchResetAllowed)
          }
          onClick={requestReset}
        >
          <RefreshCw size={15} />
          {resetting ? "Resetting…" : "Reset"}
        </button>
      </div>
      {(error || notice) && (
        <div
          className={`pp-error${error ? "" : " pp-notice"}`}
          role={error ? "alert" : "status"}
        >
          {error || notice}
          <button
            aria-label={error ? "Dismiss error" : "Dismiss notice"}
            onClick={dismissMessage}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {pending && !error && !notice && (
        <p className="pp-processing-hint" role="status">
          <LoaderCircle size={15} className="pp-spinner" aria-hidden="true" />
          Source preparation is queued or running. Files cannot be changed while
          extraction is active.
        </p>
      )}
      {loading ? (
        <WorkspaceLoading label="Loading workspace..." compact />
      ) : null}
    </>
  );
}
