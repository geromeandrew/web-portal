import { Eye, LoaderCircle, Pencil, Save } from "lucide-react";
import { allocationFields, allocationHeaders } from "../presentation";
import { PrepaidOutputTable as OutputTable } from "./PrepaidOutputTable";
import { PrepaidReviewNavigation } from "./PrepaidReviewNavigation";
import { PrepaidLayoutTable } from "./PrepaidLayoutTable";
import { PrepaidFreezeButton } from "./PrepaidFreezeButton";
import { PrepaidReviewFeedback } from "./PrepaidReviewFeedback";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

export function PrepaidReviewPanel({
  workspace,
}: {
  workspace: PrepaidWorkspaceController;
}) {
  const {
    tab,
    region,
    variant,
    layout,
    busy,
    saving,
    toast,
    editing,
    saveChanges,
    beginEdit,
    dirty,
    freeze,
    summaryLoading,
    summaryError,
    setModal,
    summary,
    loading,
    retrySummary,
    outputLoading,
    output,
    outputError,
    retryOutput,
    page,
    setPage,
  } = workspace;
  let freezeReason = "";
  if (layout?.frozen) freezeReason = "This layout is already locked.";
  else if (editing || dirty) freezeReason = "Save your changes before freezing this layout.";
  else if (!layout || loading) freezeReason = "Wait for the layout to load.";
  else if (!layout.imported) freezeReason = "Complete the import before freezing this layout.";
  else if (!layout.canFreeze) freezeReason = layout.validation?.valid
    ? "Refresh the workspace and confirm the layout uses the latest sources before freezing."
    : "Resolve the validation issues below before freezing.";
  return (
    <>
      <PrepaidReviewNavigation workspace={workspace} />
      <div className="pp-review">
        <div className="pp-panel-heading">
          <h2>
            {region.toUpperCase()}{" "}
            {tab === "allocation"
              ? `${variant.toUpperCase()} Allocation`
              : tab === "jv"
                ? "JV"
                : "Layout Review"}
          </h2>
          {tab.endsWith("layout") && layout?.frozen && (
            <span className="pp-locked" role="status">Layout frozen</span>
          )}
          <div className="pp-actions pp-layout-actions">
            {tab.endsWith("layout") ? (
              <>
                <button
                  className="pp-outline"
                  disabled={busy || !layout?.imported}
                  aria-busy={saving}
                  aria-describedby={saving ? "prepaid-save-status" : undefined}
                  onClick={() => (editing ? saveChanges() : beginEdit())}
                >
                  {saving ? (
                    <LoaderCircle
                      size={16}
                      className="pp-spinner"
                      aria-hidden="true"
                    />
                  ) : editing ? (
                    <Save size={16} />
                  ) : (
                    <Pencil size={16} />
                  )}
                  {saving ? "Saving..." : editing ? "Save" : "Edit"}
                </button>
                <PrepaidFreezeButton
                  reason={freezeReason || (busy ? "Wait for the current action to finish." : "")}
                  onClick={freeze}
                />
              </>
            ) : tab === "allocation" ? (
              <button
                className="pp-outline"
                disabled={summaryLoading || !!summaryError || !layout}
                onClick={() => setModal("breakdown")}
              >
                <Eye size={17} />
                View breakdown
              </button>
            ) : null}
          </div>
        </div>
        <div className="pp-review-content">
          <PrepaidReviewFeedback saving={saving} message={toast} />
          {tab.endsWith("layout") ? (
            <PrepaidLayoutTable workspace={workspace} />
          ) : tab === "allocation" ? (
            <OutputTable
              rows={summary}
              fields={allocationFields}
              headers={allocationHeaders}
              loading={summaryLoading || (loading && !layout)}
              loadingLabel={`Loading ${region.toUpperCase()} ${variant.toUpperCase()} allocation...`}
              error={summaryError}
              onRetry={retrySummary}
            />
          ) : (
            <>
              <OutputTable
                loading={outputLoading || (loading && !output)}
                loadingLabel={`Loading ${region.toUpperCase()} JV...`}
                error={outputError}
                onRetry={retryOutput}
                rows={
                  output?.rows.map((row) => ({
                    posting_key: row.posting_key,
                    amount: row.amount,
                    quantity: row.quantity,
                    ...(row.fields as Record<string, unknown>),
                  })) ?? []
                }
                fields={[
                  "posting_key",
                  "amount",
                  "quantity",
                  ...Object.keys((output?.rows[0]?.fields ?? {}) as object),
                ]}
                headers={[
                  "POSTING KEY",
                  "AMOUNT",
                  "QUANTITY",
                  ...Object.keys((output?.rows[0]?.fields ?? {}) as object).map(
                    (k) => k.replaceAll("_", " ").toUpperCase(),
                  ),
                ]}
              />
              <div className="pp-pagination">
                <button
                  disabled={page === 0 || outputLoading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>Page {page + 1}</span>
                <button
                  disabled={!output || (page + 1) * 100 >= output.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
