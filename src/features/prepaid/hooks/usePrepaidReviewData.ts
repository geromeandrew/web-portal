import { useCallback, useEffect, useRef, useState } from "react";
import { prepaid, type Output, type Region } from "../../../lib/prepaidApi";

/** Keyed state prevents an old tab/page/revision from flashing during navigation. */
function useResource<T>(key: string | null, path: string | null) {
  const cache = useRef(new Map<string, T>());
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    if (!key || !path || cache.current.has(key)) return;
    const controller = new AbortController();
    let cancelled = false;
    void prepaid<T>(path, { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        cache.current.set(key, data);
        if (cache.current.size > 24)
          cache.current.delete(cache.current.keys().next().value!);
        setState({ key, data });
      })
      .catch((error) => {
        if (!cancelled) setState({ key, error: (error as Error).message });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, path, attempt]);
  const data = key ? cache.current.get(key) : undefined;
  const error = key && state?.key === key ? (state.error ?? "") : "";
  const retry = useCallback(() => {
    if (key) {
      cache.current.delete(key);
      setState(undefined);
      setAttempt((n) => n + 1);
    }
  }, [key]);
  return { data, error, loading: !!key && data === undefined && !error, retry };
}
export function usePrepaidReviewData(input: {
  runId?: string;
  revisionId?: string;
  version?: number;
  stage: number;
  tab: string;
  region: Region;
  variant: string;
  page: number;
  breakdown: boolean;
}) {
  const {
    runId,
    revisionId,
    version,
    stage,
    tab,
    region,
    variant,
    page,
    breakdown,
  } = input;
  const ready = !!runId && !!revisionId && stage === 2;
  const base = ready ? `/runs/${runId}/layouts/${region}` : null;
  const identity = `${runId}:${revisionId}:${version}:${region}`;
  const summary = useResource<{ rows: Record<string, unknown>[] }>(
    ready && tab === "allocation" ? `${identity}:summary:${variant}` : null,
    base && tab === "allocation"
      ? `${base}/allocation-summary?variant=${variant}`
      : null,
  );
  const kind =
    tab === "jv"
      ? "jv"
      : tab === "allocation" && breakdown
        ? "allocations"
        : null;
  const output = useResource<Output>(
    ready && kind
      ? `${identity}:${kind}:${kind === "jv" ? "all" : variant}:${page}`
      : null,
    base && kind
      ? `${base}/${kind}?limit=100&offset=${page * 100}${kind === "allocations" ? `&variant=${variant}` : ""}`
      : null,
  );
  return {
    output: output.data ?? null,
    outputLoading: output.loading,
    outputError: output.error,
    retryOutput: output.retry,
    summary: summary.data?.rows ?? [],
    summaryLoading: summary.loading,
    summaryError: summary.error,
    retrySummary: summary.retry,
  };
}
