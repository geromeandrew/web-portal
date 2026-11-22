import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiClientError, downloadApiFile } from "../../../lib/apiClient";
import { usePrepaidReviewData } from "./usePrepaidReviewData";
import {
  post,
  prepaid,
  uploadSource,
  findPrepaidUploadSource,
  type Layout,
  type PrepaidBatchStatus,
  type Region,
  type Run,
  type Sources,
  type WorkspaceResetContext,
} from "../../../lib/prepaidApi";
import type { Tab, Transfer, Modal, PrepaidUploadSession } from "../types";
import { usePrepaidHistory } from "./usePrepaidHistory";
import { usePrepaidProgress } from "./usePrepaidProgress";

/** Coordinates uploads and revision actions, preserving source-version guards.
 * History, progress polling and review caching each have their own hook.
 * Components render this state; mutations and refresh coordination stay here.
 */
export function usePrepaidWorkspace() {
  const params = useParams();
  const navigate = useNavigate();
  const tab: Tab =
    params.section === "sg-layout"
      ? "sg-layout"
      : params.section === "allocation"
        ? "allocation"
        : params.section === "jv"
          ? "jv"
          : "eg-layout";
  const region: Region =
    tab === "sg-layout"
      ? "sg"
      : tab === "eg-layout"
        ? "eg"
        : params.region === "sg"
          ? "sg"
          : "eg";
  const variant = params.variant === "bb" ? "bb" : "mt";
  const [stage, setStage] = useState<1 | 2>(
    params.section === "file-upload" ? 1 : 2,
  );
  const [run, setRun] = useState<Run | null>(null);
  const [resetContext, setResetContext] =
    useState<WorkspaceResetContext | null>(null);
  const [removal, setRemoval] = useState<Sources["files"][number] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const actionInFlight = useRef(false);
  const [awsBatch, setAwsBatch] = useState<PrepaidBatchStatus | null>();
  const [awsBatchActive, setAwsBatchActive] = useState(false);
  const [awsBatchResetAllowed, setAwsBatchResetAllowed] = useState(false);
  const [awsBatchReviewReady, setAwsBatchReviewReady] = useState(false);
  const openedReviewBatch = useRef<string | null>(null);
  const [awsBatchEnabled, setAwsBatchEnabled] = useState(false);
  const [session, setSession] = useState<PrepaidUploadSession | null>(null);
  const [sources, setSources] = useState<Sources | null>(null),
    [layouts, setLayouts] = useState<Partial<Record<Region, Layout>>>({});
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [uploadStartedAt, setUploadStartedAt] = useState<number>();

  const [hydratingReview, setHydratingReview] = useState(false);
  const hydratedRun = useRef<string | null>(null),
    processingSeen = useRef(false);
  const workspaceGeneration = useRef(0);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false),
    [changes, setChanges] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<Modal>(null);
  const [batchDirty, setBatchDirty] = useState(false);
  const [confirmation, setConfirmation] = useState<{ message: string; proceed: () => void } | null>(null);
  const confirmAction = (message: string, proceed: () => void) => setConfirmation({ message, proceed });
  const {
    historyDate,
    setHistoryDate,
    reports,
    historyOffset,
    setHistoryOffset,
    hasMore,
    historyLoading,
    setHistoryLoading,
    historyError,
    setHistoryError,
    setHistoryAttempt,
  } = usePrepaidHistory(modal);
  const [page, setPage] = useState(0);

  const input = useRef<HTMLInputElement>(null),
    generation = useRef(0),
    mounted = useRef(true),
    activeTransfers = useRef<Transfer[]>([]);
  const uploadRefresh = useRef<{
    dirty: boolean;
    promise: Promise<void>;
  } | null>(null);
  const pending = session?.status === "pending";

  const layout = layouts[region],
    dirty = Object.keys(changes).length > 0,
    uploading = transfers.some((t) => t.status === "uploading");
  const {
    output,
    outputLoading,
    outputError,
    retryOutput,
    summary,
    summaryLoading,
    summaryError,
    retrySummary,
  } = usePrepaidReviewData({
    runId: run?.id,
    revisionId: layout?.id,
    version: layout?.version,
    stage,
    tab,
    region,
    variant,
    page,
    breakdown: modal === "breakdown",
  });
  // Transfers use the original inline file rows. Only server preparation locks
  // the workspace, including the final loading of both review layouts.
  const processing = pending || (hydratingReview && processingSeen.current);
  const [progressHidden, setProgressHidden] = useState(false);
  const close = useCallback(() => {
    if (!actionInFlight.current) setModal(null);
  }, []);
  const notify = (text: string) => setToast(text);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    activeTransfers.current = transfers;
  }, [transfers]);
  useEffect(
    () => () => {
      mounted.current = false;
      activeTransfers.current.forEach((t) => t.controller.abort());
    },
    [],
  );
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty || batchDirty || uploading) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const click = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (
        (dirty || batchDirty || uploading) &&
        anchor?.href &&
        anchor.href !== location.href
      ) {
        e.preventDefault();
        e.stopPropagation();
        const href = anchor.href;
        confirmAction("Leave this workspace? Unsaved edits and ongoing uploads may be lost.", () => {
          const target = new URL(href);
          if (target.origin === location.origin) navigate(target.pathname + target.search + target.hash);
          else window.location.assign(href);
        });
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, batchDirty, uploading, navigate]);
  const refresh = useCallback(async (id: string, workspaceToken?: number) => {
    const token = ++generation.current;
    const [next, files, eg, sg] = await Promise.all([
      prepaid<Run>(`/runs/${id}`),
      prepaid<Sources>(`/runs/${id}/sources`),
      prepaid<Layout>(`/runs/${id}/layouts/eg`),
      prepaid<Layout>(`/runs/${id}/layouts/sg`),
    ]);
    if (
      token === generation.current &&
      mounted.current &&
      (workspaceToken === undefined ||
        workspaceToken === workspaceGeneration.current)
    ) {
      setRun(next);
      setSources(files);
      setLayouts({ eg, sg });
    }
    return { next, eg, sg };
  }, []);
  const refreshWorkspace = useCallback(async () => {
    const token = ++workspaceGeneration.current;
    const state = await prepaid<{
      awsBatchEnabled?: boolean;
      awsBatch?: PrepaidBatchStatus | null;
      awsBatchActive?: boolean;
      awsBatchResetAllowed?: boolean;
      awsBatchReviewReady?: boolean;
      session: typeof session;
      run: Run | null;
      sources: Sources;
      error: string | null;
      preparation?: { configured: boolean; message: string | null };
      resetContext?: WorkspaceResetContext | null;
    }>("/workspace");
    if (!mounted.current || token !== workspaceGeneration.current) return;
    if (state.session?.status === "pending") processingSeen.current = true;
    if (
      state.run &&
      (hydratedRun.current !== state.run.id || processingSeen.current)
    )
      setHydratingReview(true);
    setSources(state.sources);
    setSession(state.session);
    setAwsBatchEnabled(state.awsBatchEnabled === true);
    setAwsBatch(state.awsBatch);
    setAwsBatchActive(state.awsBatchActive === true);
    setAwsBatchResetAllowed(state.awsBatchResetAllowed === true);
    setAwsBatchReviewReady(state.awsBatchReviewReady === true);
    setResetContext(state.resetContext ?? null);
    setError(state.error ?? "");
    setNotice(state.preparation?.message ?? "");
    if (state.awsBatchEnabled) {
      setHydratingReview(false);
      if (!state.awsBatchReviewReady && state.awsBatch?.status !== "queued" && state.awsBatch?.status !== "running") setStage(1);
      return;
    }
    if (state.run) {
      let loaded;
      try {
        loaded = await refresh(state.run.id, token);
      } catch (error) {
        if (token === workspaceGeneration.current) setHydratingReview(false);
        throw error;
      }
      if (!mounted.current || token !== workspaceGeneration.current) return;
      hydratedRun.current = state.run.id;
      setHydratingReview(false);
      processingSeen.current = false;
      setStage(loaded.eg.imported && loaded.sg.imported ? 2 : 1);
    } else {
      generation.current++;
      hydratedRun.current = null;
      setHydratingReview(false);
      setRun(null);
      setLayouts({});
      setStage(1);
    }
  }, [refresh]);
  useEffect(() => {
    mounted.current = true;
    void refreshWorkspace()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [refreshWorkspace]);
  const perform = async (work: () => Promise<void>, action?: "save") => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    if (action === "save") {
      setSaving(true);
      setToast("");
    }
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiClientError && e.status === 409) {
        setEditing(false);
        setChanges({});
        const message = (e as Error).message;
        await refreshWorkspace().catch(() => undefined);
        setError(message);
      }
    } finally {
      actionInFlight.current = false;
      if (mounted.current) {
        setBusy(false);
        if (action === "save") setSaving(false);
      }
    }
  };
  const confirmLeave = (proceed: () => void) => {
    if (dirty || batchDirty) confirmAction("Discard your unsaved layout edits?", proceed);
    else proceed();
  };
  const switchTab = (
    next: Tab,
    nextRegion: Region = region,
    nextVariant = variant,
  ) => {
    if (actionInFlight.current) return;
    confirmLeave(() => {
      setEditing(false);
      setChanges({});
      setPage(0);
      navigate(
        `/prepaid/${next}${next === "allocation" ? `/${nextRegion}/${nextVariant}` : next === "jv" ? `/${nextRegion}/mt` : ""}`,
      );
      setStage(2);
    });
  };
  const reviewBatchId = awsBatch?.id ?? "current";
  useEffect(() => {
    if (!awsBatchReviewReady) {
      openedReviewBatch.current = null;
      return;
    }
    if (openedReviewBatch.current === reviewBatchId) return;
    openedReviewBatch.current = reviewBatchId;
    if (stage === 1) {
      setStage(2);
      navigate("/prepaid/eg-layout", { replace: true });
    }
  }, [awsBatchReviewReady, navigate, reviewBatchId, stage]);

  const pollAwsBatch = awsBatchEnabled &&
    (awsBatch?.status === "queued" || awsBatch?.status === "running");
  const waitingForConfiguration = !!session && sources?.collectionOnly === true;
  useEffect(() => {
    if (!pending && !waitingForConfiguration && !pollAwsBatch) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await refreshWorkspace();
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      } finally {
        if (!stopped) timer = setTimeout(poll, 4000);
      }
    };
    timer = setTimeout(poll, 4000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pending, waitingForConfiguration, pollAwsBatch, refreshWorkspace]);
  const {
    progress,
    progressError,
    checkingProgress,
    progressNow,
    checkProgress,
    setProgressError,
    setProgress,
  } = usePrepaidProgress({ session, pending, processing, mounted });

  const startUpload = async (file: File) => {
    if (busy || loading || pending || awsBatchActive) {
      setError("Wait for source preparation before uploading.");
      return;
    }
    const expected = findPrepaidUploadSource(sources, file.name);
    if (!expected) {
      setError(
        `Unrecognized filename: ${file.name}. Use the exact names in File Guidelines.`,
      );
      return;
    }
    if (
      activeTransfers.current.some(
        (t) => t.code === expected.code && t.status === "uploading",
      )
    )
      return;
    if (!activeTransfers.current.some((t) => t.status === "uploading")) {
      processingSeen.current = true;
      setUploadStartedAt(Date.now());
    }
    const transfer: Transfer = {
      code: expected.code,
      file,
      percent: 0,
      status: "uploading",
      controller: new AbortController(),
    };
    activeTransfers.current = [
      ...activeTransfers.current.filter((t) => t.code !== transfer.code),
      transfer,
    ];
    setTransfers(activeTransfers.current);
    let acknowledged = false;
    try {
      const receipt = await uploadSource(
        "",
        transfer.code,
        file,
        transfer.controller.signal,
        (percent) =>
          setTransfers((old) =>
            old.map((t) =>
              t.controller === transfer.controller ? { ...t, percent } : t,
            ),
          ),
        true,
      );
      acknowledged = true;
      setSources((old) =>
        old && receipt.id
          ? {
              ...old,
              files: [
                ...old.files.filter((f) => f.source_code !== transfer.code),
                {
                  id: receipt.id,
                  source_code: transfer.code,
                  original_name: file.name,
                },
              ],
            }
          : old,
      );
      // Coalesce closely completing files instead of issuing a full set of
      // workspace/layout queries independently for every upload.
      if (!uploadRefresh.current) {
        const batch = { dirty: true, promise: Promise.resolve() };
        batch.promise = (async () => {
          try {
            do {
              await new Promise((resolve) => setTimeout(resolve, 150));
              batch.dirty = false;
              if (mounted.current) await refreshWorkspace();
            } while (batch.dirty && mounted.current);
          } finally {
            uploadRefresh.current = null;
          }
        })();
        uploadRefresh.current = batch;
      } else uploadRefresh.current.dirty = true;
      await uploadRefresh.current.promise;
      setTransfers((old) =>
        old.filter((t) => t.controller !== transfer.controller),
      );
    } catch (e) {
      if (acknowledged)
        setError(
          "File uploaded successfully, but the workspace could not refresh. Refresh to see the latest processing status.",
        );
      else await refreshWorkspace().catch(() => undefined);
      if (acknowledged || (e as Error).name === "AbortError")
        setTransfers((old) =>
          old.filter((t) => t.controller !== transfer.controller),
        );
      else
        setTransfers((old) =>
          old.map((t) =>
            t.controller === transfer.controller
              ? { ...t, status: "failed", error: (e as Error).message }
              : t,
          ),
        );
    }
  };
  const canStartProcessing =
    awsBatchEnabled && !!sources?.files.length && !loading && !uploading &&
    !pending && !awsBatchActive;
  const startProcessing = () => void perform(async () => {
    if (!canStartProcessing || activeTransfers.current.some((transfer) => transfer.status === "uploading")) return;
    await post("/workspace/prepare");
    setProgressHidden(false);
    await refreshWorkspace();
    setStage(2);
    navigate("/prepaid/eg-layout");
  });
  const beginEdit = () =>
    void perform(async () => {
      if (!run || !layout?.imported) return;
      if (layout.frozen) {
        await post("/runs/" + run.id + "/layouts/" + region + "/edit", {
          version: layout.version,
        });
        await refresh(run.id);
      }
      setEditing(true);
      setChanges({});
    });
  const saveChanges = () =>
    void perform(async () => {
      if (!run || !layout) return;
      const cells = Object.entries(changes).map(([key, value]) => {
        const [number, field] = key.split(":");
        if (value && !/^-?\d{1,28}(?:\.\d{1,10})?$/.test(value))
          throw new Error(
            "Enter a decimal amount without commas (up to 28 integer and 10 fractional digits).",
          );
        return { layoutNumber: Number(number), field, value: value || null };
      });
      if (cells.length) {
        // PATCH returns the committed, recalculated layout and its new version.
        // Use that authoritative result rather than waiting for four more reads.
        const saved = await prepaid<Layout>(
          "/runs/" + run.id + "/layouts/" + region,
          {
            method: "PATCH",
            body: JSON.stringify({ version: layout.version, changes: cells }),
          },
        );
        if (!mounted.current) return;
        generation.current++;
        setLayouts((current) => ({ ...current, [region]: saved }));
      }
      setChanges({});
      setEditing(false);
      notify("Edits saved");
    }, "save");
  const freeze = () =>
    perform(async () => {
      if (!run || !layout) return;
      await post(`/runs/${run.id}/layouts/${region}/freeze`, {
        version: layout.version,
      });
      await refresh(run.id);
      notify(
        `Your ${region.toUpperCase()} reclassifications have been saved and locked.\nThe data is now staged and waiting for manual SAP execution.`,
      );
    });
  const reset = () =>
    perform(async () => {
      setResetting(true);
      let acknowledged = false;
      try {
        await post("/workspace/reset", {
          ...(run && layouts.eg && layouts.sg
            ? {
                runId: run.id,
                eg: layouts.eg.version,
                sg: layouts.sg.version,
              }
            : (resetContext ?? {})),
          ...(session
            ? { sessionId: session.id, sessionVersion: session.version }
            : {}),
        });
        acknowledged = true;
        // Invalidate older polls before clearing the acknowledged working state.
        workspaceGeneration.current++;
        generation.current++;
        setRun(null);
        setSession(null);
        setProgress(null);
        setUploadStartedAt(undefined);
        processingSeen.current = false;
        setResetContext(null);
        setLayouts({});
        setSources((old) => (old ? { ...old, files: [], valid: false } : old));
        setEditing(false);
        setChanges({});
        setTransfers([]);
        setStage(1);
        navigate("/prepaid/file-upload");
        setModal("reset-success");
        await refreshWorkspace();
      } catch (e) {
        if (!acknowledged) throw e;
        setNotice(
          "Workspace reset successfully, but its latest state could not be loaded. Refresh before uploading new files.",
        );
      } finally {
        setResetting(false);
      }
    });
  const removeFile = () =>
    perform(async () => {
      if (!removal) return;
      const file = removal;
      setRemoving(file.id);
      let acknowledged = false;
      try {
        await prepaid(
          session
            ? `/workspace/sources/${file.source_code}`
            : `/runs/${run!.id}/sources/${file.source_code}`,
          { method: "DELETE" },
        );
        acknowledged = true;
        workspaceGeneration.current++;
        setSources((old) =>
          old
            ? {
                ...old,
                files: old.files.filter((f) => f.id !== file.id),
                valid: false,
              }
            : old,
        );
        setTransfers((old) => old.filter((t) => t.code !== file.source_code));
        setModal(null);
        setRemoval(null);
        notify(`${file.original_name} removed from the workspace.`);
        await refreshWorkspace();
        setStage(1);
        navigate("/prepaid/file-upload");
      } catch (e) {
        if (!acknowledged) throw e;
        setNotice(
          "File removed successfully, but the workspace could not refresh. Refresh before making another change.",
        );
      } finally {
        setRemoving(null);
      }
    });
  const download = (path: string, name: string) =>
    perform(async () => {
      await downloadApiFile("/workflows/prepaid" + path, name);
    });
  const openHistory = () => {
    if (actionInFlight.current) return;
    setHistoryOffset(0);
    setHistoryLoading(true);
    setHistoryError("");
    setModal("history");
  };
  const selectStage = (step: 1 | 2) => {
    if (actionInFlight.current) return;
    if (step === 2 && awsBatchEnabled && !awsBatchReviewReady) {
      if (canStartProcessing) startProcessing();
      return;
    }
    if (step === 2 && !awsBatchEnabled && session?.status === "failed") {
      void perform(async () => {
        await post("/workspace/prepare");
        await refreshWorkspace();
      });
      return;
    }
    confirmLeave(() => {
      setStage(step);
      setEditing(false);
      setChanges({});
      navigate(step === 1 ? "/prepaid/file-upload" : "/prepaid/eg-layout");
    });
  };
  const requestReset = () => {
    setError("");
    setModal("reset");
  };
  const dismissMessage = () => (error ? setError("") : setNotice(""));
  const checkProcessingStatus = () => {
    void checkProgress();
    void refreshWorkspace().catch((e) =>
      setProgressError((e as Error).message),
    );
  };
  return {
    openHistory,
    confirmation,
    setConfirmation,
    confirmAction,
    setBatchDirty,
    selectStage,
    requestReset,
    dismissMessage,
    checkProcessingStatus,
    setHistoryOffset,
    setHistoryLoading,
    setHistoryError,
    setModal,
    stage,
    layouts,
    awsBatchEnabled,
    awsBatch,
    awsBatchActive,
    awsBatchResetAllowed,
    awsBatchReviewReady,
    session,
    sources,
    canStartProcessing,
    startProcessing,
    perform,
    refreshWorkspace,
    setChanges,
    run,
    loading,
    busy,
    saving,
    uploading,
    pending,
    setError,
    resetting,
    error,
    notice,
    input,
    startUpload,
    transfers,
    removing,
    setRemoval,
    setTransfers,
    tab,
    switchTab,
    region,
    variant,
    layout,
    editing,
    saveChanges,
    beginEdit,
    dirty,
    freeze,
    summaryLoading,
    summaryError,
    changes,
    summary,
    retrySummary,
    outputLoading,
    output,
    outputError,
    retryOutput,
    page,
    setPage,
    processing,
    progressHidden,
    setProgressHidden,
    hydratingReview,
    uploadStartedAt,
    progress,
    progressNow,
    progressError,
    checkingProgress,
    modal,
    close,
    removal,
    removeFile,
    reset,
    historyDate,
    setHistoryDate,
    historyLoading,
    historyError,
    reports,
    download,
    setHistoryAttempt,
    historyOffset,
    hasMore,
    toast,
  };
}
export type PrepaidWorkspaceController = ReturnType<typeof usePrepaidWorkspace>;
