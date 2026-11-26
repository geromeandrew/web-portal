import { useCallback, useEffect, useState } from "react";
import { Eye, LoaderCircle, Pencil, Save } from "lucide-react";
import { ApiClientError, downloadApiFile } from "../../../lib/apiClient";
import { PrepaidDialog as Dialog } from "./PrepaidDialog";
import { formatMoney, prepaid, post, moneyFields, ungroupPrepaidAmount, type PrepaidBatchStatus } from "../../../lib/prepaidApi";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";
import { allocationFields, allocationHeaders, headings } from "../presentation";
import { PrepaidAllocationBreakdown } from "./PrepaidAllocationBreakdown";
import { PrepaidOutputTable } from "./PrepaidOutputTable";
import { PrepaidReviewNavigation } from "./PrepaidReviewNavigation";
import { PrepaidReportsPanel } from "./PrepaidReportsPanel";
import { PrepaidActionNotice } from "./PrepaidActionNotice";
import { PrepaidFreezeButton } from "./PrepaidFreezeButton";
import { PrepaidReviewFeedback } from "./PrepaidReviewFeedback";
import { PrepaidAwsJobProgress } from "./PrepaidAwsJobProgress";

type Side = "eg" | "sg";
type Review = {
  rows: Record<string, unknown>[];
  hasMore: boolean;
  pendingJournal: boolean;
  canEdit?: boolean;
  layoutVersion?: string;
  freezeInputReason?: string | null;
  unavailableReason?: string;
};

type Workspace = Pick<PrepaidWorkspaceController, "stage" | "selectStage" | "tab" | "region" | "variant" | "switchTab" | "page" | "setPage" | "busy" | "perform">;

export function PrepaidAwsBatch({ workspace, processingWorkspace }: { workspace: Workspace; processingWorkspace?: PrepaidWorkspaceController }) {
  const [standaloneBatch, setStandaloneBatch] = useState<PrepaidBatchStatus | null>(null);
  const workspaceBatch = processingWorkspace?.awsBatch;
  const refreshWorkspace = processingWorkspace?.refreshWorkspace;
  const hasWorkspaceBatch = workspaceBatch !== undefined;
  const batch = hasWorkspaceBatch ? workspaceBatch : standaloneBatch;
  const [startingFreeze, setStartingFreeze] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const busy = startingFreeze || saving || workspace.busy;

  useEffect(() => {
    if (!saveMessage) return;
    const timer = window.setTimeout(() => setSaveMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [saveMessage]);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const refresh = useCallback(async () => {
    if (hasWorkspaceBatch && refreshWorkspace) {
      await refreshWorkspace();
    } else {
      const state = await prepaid<{ batch: PrepaidBatchStatus | null }>("/aws-batch", { cache: "no-store" });
      setStandaloneBatch(state.batch);
    }
    setPollError("");
  }, [hasWorkspaceBatch, refreshWorkspace]);
  useEffect(() => {
    if (hasWorkspaceBatch) return;
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        await refresh();
      } catch (e) {
        if (!stopped) setPollError(e instanceof Error ? e.message : "Could not refresh processing status.");
      } finally {
        if (!stopped) timer = window.setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [hasWorkspaceBatch, refresh]);

  const { region, variant, tab, page, setPage } = workspace;
  const section = tab === "allocation" ? "allocation-summary" : tab === "jv" ? "jv" : "layout";
  const batchId = batch?.id;
  const processing = batch?.status === "queued" || batch?.status === "running";
  const canLoad = workspace.stage === 2 && tab !== "reports" && !!batch?.canReview && !processing;
  const reviewScope = [batchId, region, section, variant, page].join(":");
  const [loadedReview, setReview] = useState<{ scope: string; data: Review } | null>(null);
  const review = loadedReview?.scope === reviewScope ? loadedReview.data : null;
  const canEditLayout = !!review?.canEdit && !!review.layoutVersion;
  const [reviewError, setReviewError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownPage, setBreakdownPage] = useState(0);
  const [breakdown, setBreakdown] = useState<Review | null>(null);
  const [breakdownError, setBreakdownError] = useState("");
  const [breakdownAttempt, setBreakdownAttempt] = useState(0);
  const closeBreakdown = useCallback(() => setBreakdownOpen(false), []);

  useEffect(() => {
    setBreakdown(null);
    setBreakdownError("");
    if (!breakdownOpen || !canLoad || !batchId || section !== "allocation-summary") return;
    let current = true;
    const query = new URLSearchParams({ batchId, variant, offset: String(breakdownPage * 100) });
    void prepaid<Review>(`/aws-batch/review/${region}/allocation?${query}`, { cache: "no-store" })
      .then((data) => { if (current) setBreakdown(data); })
      .catch((e: Error) => { if (current) setBreakdownError(e.message); });
    return () => { current = false; };
  }, [breakdownOpen, breakdownPage, breakdownAttempt, canLoad, batchId, section, region, variant]);
  const [editVersion, setEditVersion] = useState<string>();
  const [changes, setChanges] = useState<Record<string, string>>({});
  const setBatchDirty = processingWorkspace?.setBatchDirty;
  useEffect(() => {
    setBatchDirty?.(Object.keys(changes).length > 0);
    return () => setBatchDirty?.(false);
  }, [changes, setBatchDirty]);

  useEffect(() => {
    setEditVersion(undefined);
    setChanges({});
    setError("");
    setBreakdownOpen(false);
    setSaveMessage("");
  }, [batchId, region, section, variant, workspace.stage]);

  useEffect(() => {
    setReview(null);
    setReviewError("");
    if (!canLoad || !batchId) return;
    let current = true;
    const query = new URLSearchParams({ batchId, variant, offset: String(page * 100) });
    void prepaid<Review>(`/aws-batch/review/${region}/${section}?${query}`, { cache: "no-store" })
      .then((data) => { if (current) setReview({ scope: reviewScope, data }); })
      .catch((e: Error) => { if (current) setReviewError(e.message); });
    return () => { current = false; };
  }, [canLoad, batchId, region, section, variant, page, attempt, reviewScope]);

  function cancelEdit() {
    setEditVersion(undefined);
    setChanges({});
    setError("");
    setAttempt((value) => value + 1);
  }

  async function editOrSave() {
    if (!batchId || !canEditLayout) return;
    if (!editVersion) {
      setEditVersion(review?.layoutVersion);
      setSaveMessage("");
      setError("");
      return;
    }

    const changedCells = Object.entries(changes).map(([key, value]) => {
      const [layoutNumber, field] = key.split(":");
      return { layoutNumber: Number(layoutNumber), field, value: ungroupPrepaidAmount(value) || null };
    });
    if (!changedCells.length) {
      setEditVersion(undefined);
      return;
    }
    if (changedCells.some(({ value }) => value !== null && !/^-?\d{1,28}(?:\.\d{1,10})?$/.test(value))) {
      setError("Enter a valid amount, such as 1,234.56.");
      return;
    }

    await workspace.perform(async () => {
      setSaving(true);
      setSaveMessage("");
      setError("");
      try {
        const saved = await prepaid<Review>(`/aws-batch/review/${region}/layout`, {
          method: "PATCH",
          body: JSON.stringify({ batchId, layoutVersion: editVersion, changes: changedCells }),
        });
        setReview({ scope: reviewScope, data: saved });
        setEditVersion(undefined);
        setChanges({});
        setSaveMessage("Edits saved");
        await refresh().catch((e: Error) => setPollError(e.message));
      } catch (e) {
        setError(e instanceof ApiClientError && e.code === "PREPAID_STALE_VERSION"
          ? "The layout changed before your edits could be saved. Cancel to reload the layout and try again."
          : e instanceof Error ? e.message : "Could not save the layout.");
      } finally {
        setSaving(false);
      }
    });
  }

  const [confirmSide, setConfirmSide] = useState<Side | null>(null);
  const [pendingSide, setPendingSide] = useState<Side | null>(null);
  const [expandedFreeze, setExpandedFreeze] = useState<string | null>(null);
  const closeConfirmation = useCallback(() => setConfirmSide(null), []);

  useEffect(() => {
    if (!pendingSide || startingFreeze) return;
    if (batch?.phase === pendingSide || batch?.executions[pendingSide]?.journal || batch?.status === "closed") {
      setPendingSide(null);
      return;
    }
    if (!hasWorkspaceBatch) return;
    // An accepted freeze can outlive a failed status read. Retry until the workspace sees it.
    const timer = window.setInterval(() => {
      void refresh().catch((e: Error) => setPollError(e.message));
    }, 4000);
    return () => window.clearInterval(timer);
  }, [batch, hasWorkspaceBatch, pendingSide, refresh, startingFreeze]);

  const awaitingImport = processingWorkspace?.awaitingAwsImport;
  const phase = pendingSide ?? (awaitingImport ? "import" : batch?.phase);
  const progressKey = `${batchId}:${phase}`;
  const setFreezeExpanded = useCallback((open: boolean) => {
    setExpandedFreeze(open ? progressKey : null);
  }, [progressKey]);

  async function freeze(side: Side) {
    if (side !== region || freezeBlocked) return;
    setConfirmSide(null);
    setPendingSide(side);
    setExpandedFreeze(`${batchId}:${side}`);
    setStartingFreeze(true);
    setError("");
    try {
      await post("/aws-batch/action", { action: side });
      setStartingFreeze(false);
      await refresh().catch((e: Error) => setPollError(e.message));
    } catch (e) {
      setPendingSide(null);
      setError(e instanceof Error ? e.message : "Could not start freeze.");
    } finally {
      setStartingFreeze(false);
    }
  }

  async function download() {
    if (!batch || !journal || downloading) return;
    setDownloading(true);
    setError("");
    try {
      await downloadApiFile(
        `/workflows/prepaid/aws-batch/${batch.id}/journal/${region}`,
        journal.filename.replace(/\.txt$/i, ".xlsx"),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the journal.");
    } finally {
      setDownloading(false);
    }
  }

  const waitingSide = pendingSide ?? (processing && (phase === "eg" || phase === "sg") ? phase : null);
  const jobState = awaitingImport || waitingSide || processing ? "active"
    : batch?.status === "failed" ? "failed"
    : batch?.status === "review" && (phase === "import" ? batch.canReview
      : phase && (phase === "eg" || phase === "sg") && !!batch.executions[phase]?.journal) ? "complete" : null;
  const progressStrip = phase && phase !== "cleanup" && phase !== "release" && jobState && (
    <PrepaidAwsJobProgress
      key={progressKey}
      phase={phase}
      state={jobState}
      importProgress={{
        stage: batch?.executions?.import?.importStage ?? (awaitingImport || batch?.status === "queued" ? "queued" : "running"),
        startedAt: batch?.executions?.import?.startedAt,
      }}
      submitting={startingFreeze && batch?.phase !== phase}
      queued={batch?.status === "queued"}
      reconnecting={!!pollError || !!processingWorkspace?.awsStatusError}
      message={batch?.error}
      expanded={phase === "import" && processingWorkspace ? processingWorkspace.awsImportProgressOpen : expandedFreeze === progressKey}
      setExpanded={phase === "import" && processingWorkspace ? processingWorkspace.setAwsImportProgressOpen : setFreezeExpanded}
      onComplete={() => phase === "import" ? workspace.switchTab("eg-layout", "eg") : workspace.switchTab("jv", phase)}
    />
  );

  if (!batch || batch.status === "closed")
    return progressStrip || (pollError ? <PrepaidActionNotice tone="error">{pollError}</PrepaidActionNotice> : null);
  if (batch.phase === "cleanup" || batch.phase === "release")
    return batch.error ? <PrepaidActionNotice tone="error">{batch.error}</PrepaidActionNotice> : null;

  if (workspace.stage === 1 || !batch.canReview) {
    const statusError = error || (!progressStrip && (batch.error || pollError));
    return (
      <>
        {progressStrip}
        {statusError && <PrepaidActionNotice tone="error">{statusError}</PrepaidActionNotice>}
      </>
    );
  }

  const layout = batch.layouts[region];
  const variance = layout?.find((row) => row.label === "Variance")?.gross;
  const gross = typeof variance === "string" ? variance.trim() : "";
  const hasVariance = /^[+-]?\d+(\.\d+)?$/.test(gross);
  const nonzeroVariance = hasVariance && /[1-9]/.test(gross);
  const label = region.toUpperCase();
  const execution = batch.executions[region];
  const journal = execution?.journal;
  const locked = !!journal || !!layout?.some((row) => row.frozen);
  const processingReason = waitingSide || processing ? "Wait for processing to finish." : "";
  const previousFreeze = !execution || journal ? ""
    : execution.status === "SUCCEEDED" ? "The layout was frozen. Contact support to verify the journal before continuing."
    : "A previous freeze did not complete. Contact support to review its status.";
  const reviewUnavailable = review ? "" : reviewError ? "Reload the layout before continuing." : "Wait for the layout to load.";
  let freezeReason = "";
  if (journal) freezeReason = "Layout frozen and journal delivered";
  else if (processingReason) freezeReason = processingReason;
  else if (previousFreeze) freezeReason = previousFreeze;
  else if (locked) freezeReason = "This layout is already locked.";
  else if (editVersion) freezeReason = "Save your changes before freezing this layout.";
  else if (!batch.deliveryEnabled) freezeReason = "Freeze and delivery are currently unavailable.";
  else if (batch.status !== "review" || batch.executions.import?.status !== "SUCCEEDED")
    freezeReason = "The import must complete successfully before you can freeze.";
  else if (pollError) freezeReason = "Wait for the processing status to reconnect before freezing.";
  else if (reviewUnavailable) freezeReason = reviewUnavailable;
  else if (review?.freezeInputReason) freezeReason = review.freezeInputReason;
  else if (!hasVariance) freezeReason = "Gross variance is unavailable. Refresh the page before freezing this layout.";
  const editReason = journal ? freezeReason : processingReason || previousFreeze
    || (locked ? "This layout is already locked." : reviewUnavailable || (!canEditLayout ? "Editing is unavailable for this layout." : ""));
  const freezeBlocked = busy || !!freezeReason;
  const title = section === "layout" ? "Layout Review" : section === "jv" ? "JV" : `${variant.toUpperCase()} Allocation`;
  const fields = section === "layout" ? ["label", ...moneyFields]
    : section === "allocation-summary" ? allocationFields : Object.keys(review?.rows[0] ?? {});
  const headers = section === "layout" ? headings.map((heading) => heading.replaceAll("EG", label))
    : section === "allocation-summary" ? allocationHeaders : fields;

  return (
    <>
      {progressStrip}
      <PrepaidReviewNavigation workspace={{
        ...workspace,
        busy: workspace.busy || busy,
        switchTab: (...args) => {
          workspace.switchTab(...args);
        },
      }} />
      {tab === "reports" ? <PrepaidReportsPanel key={batch.id} batch={batch} /> : <div className="pp-review">
        <div className="pp-panel-heading">
          <h2>{label} {title}</h2>
          {section === "layout" && locked && (
            <span className="pp-locked" role="status">
              {journal ? "Layout frozen and journal delivered" : "Layout frozen"}
            </span>
          )}
          {section === "layout" && (
            <div className="pp-actions pp-layout-actions">
              {editVersion && (
                <button type="button" className="pp-outline" disabled={busy} onClick={cancelEdit}>
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="pp-outline"
                disabled={busy || !!editReason}
                aria-busy={saving}
                aria-describedby={saving ? "prepaid-save-status" : undefined}
                onClick={() => void editOrSave()}
              >
                {saving ? (
                  <LoaderCircle size={16} className="pp-spinner" aria-hidden="true" />
                ) : editVersion ? <Save size={16} /> : <Pencil size={16} />}
                {saving ? "Saving..." : editVersion ? "Save" : "Edit"}
              </button>
              <PrepaidFreezeButton
                reason={freezeReason || (busy ? "Wait for the current action to finish." : "")}
                onClick={() => setConfirmSide(region)}
              />
            </div>
          )}
          {section === "allocation-summary" && (
            <button
              type="button"
              className="pp-outline"
              disabled={processing || !review || !!review.unavailableReason}
              onClick={() => { setBreakdownPage(0); setBreakdownOpen(true); }}
            >
              <Eye size={17} />
              View breakdown
            </button>
          )}
          {section === "jv" && journal && (
            <button type="button" className="pp-outline" disabled={downloading} aria-busy={downloading} onClick={() => void download()}>
              {downloading && <LoaderCircle size={16} className="pp-spinner" aria-hidden="true" />}
              {downloading ? "Downloading..." : "Download JV"}
            </button>
          )}
        </div>
        <div className="pp-review-content">
          {section === "layout" && <PrepaidReviewFeedback saving={saving} message={saveMessage} />}
          {(error || (!progressStrip && (batch.error || pollError))) && (
            <PrepaidActionNotice tone="error">{error || batch.error || pollError}</PrepaidActionNotice>
          )}
          {review?.unavailableReason ? (
            <PrepaidActionNotice>{review.unavailableReason}</PrepaidActionNotice>
          ) : review?.pendingJournal ? (
            <PrepaidActionNotice>{previousFreeze || (!batch.deliveryEnabled
              ? "The journal is unavailable while delivery is off."
              : `Freeze the ${label} layout to view and download its journal.`)}</PrepaidActionNotice>
          ) : (
            <PrepaidOutputTable
              rows={review?.rows ?? []}
              tableClassName={section === "layout" ? `pp-table pp-layout-table${editVersion ? " pp-layout-editing" : ""}` : undefined}
              fields={fields}
              headers={headers}
              loading={processing || (!review && !reviewError)}
              error={reviewError}
              onRetry={() => setAttempt((value) => value + 1)}
              renderCell={editVersion && section === "layout" ? (row, field) => {
                const original = String(row[field] ?? "");
                if (!Array.isArray(row.editable_fields) || !row.editable_fields.includes(field)) return undefined;
                const key = `${row.layout_number}:${field}`;
                return (
                  <input
                    className="pp-editable-amount"
                    aria-label={`${row.label} ${field}`}
                    inputMode="decimal"
                    disabled={busy}
                    value={changes[key] ?? formatMoney(original)}
                    onBlur={() => setChanges((old) => {
                      if (old[key] === undefined) return old;
                      return { ...old, [key]: formatMoney(ungroupPrepaidAmount(old[key])) };
                    })}
                    onChange={(event) => {
                      const value = event.target.value;
                      setChanges((old) => {
                        const next = { ...old };
                        if (ungroupPrepaidAmount(value) === original) delete next[key];
                        else next[key] = value;
                        return next;
                      });
                    }}
                  />
                );
              } : undefined}
            />
          )}
          {section === "jv" && !review?.pendingJournal && (page > 0 || review?.hasMore) && (
            <div className="pp-pagination">
              <button disabled={page === 0 || !review} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <span>Page {page + 1}</span>
              <button disabled={!review?.hasMore} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>}
      {breakdownOpen && section === "allocation-summary" && (
        <Dialog title="Allocation breakdown" onClose={closeBreakdown} wide>
          <PrepaidAllocationBreakdown
            workspace={{
              region,
              variant,
              outputLoading: !breakdown && !breakdownError,
              outputError: breakdownError,
              retryOutput: () => setBreakdownAttempt((value) => value + 1),
              output: breakdown,
              page: breakdownPage,
              setPage: setBreakdownPage,
            }}
            hasMore={breakdown?.hasMore ?? false}
          />
        </Dialog>
      )}
      {confirmSide && (
        <Dialog title="Confirm freeze" onClose={closeConfirmation}>
          <div className="pp-reset-dialog">
            <div className="pp-question">?</div>
            <h2>Freeze the {confirmSide.toUpperCase()} layout?</h2>
            <p>{freezeReason || "This locks the saved layout and delivers its journal."}</p>
            {nonzeroVariance && <p>Gross variance is {formatMoney(gross.replace(/^\+/, ""))}.</p>}
            <div className="pp-actions">
              <button className="pp-outline" onClick={closeConfirmation}>No, go back</button>
              <button className="pp-primary" disabled={freezeBlocked || confirmSide !== region} onClick={() => void freeze(confirmSide)}>Yes, freeze</button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
