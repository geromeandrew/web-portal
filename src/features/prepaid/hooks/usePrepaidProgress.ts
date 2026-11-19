import { useCallback, useEffect, useRef, useState } from "react";
import { type ExtractionProgress } from "../../../lib/prepaidProgress";
import { prepaid } from "../../../lib/prepaidApi";
import type { MutableRefObject } from "react";

/** Read-only extraction polling and elapsed time, scoped to the current source version. */
export function usePrepaidProgress({
  session,
  pending,
  processing,
  mounted,
}: {
  session: { id: string; version: number } | null;
  pending: boolean;
  processing: boolean;
  mounted: MutableRefObject<boolean>;
}) {
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [progressError, setProgressError] = useState("");
  const [checkingProgress, setCheckingProgress] = useState(false);
  const progressRequest = useRef(false);
  const [progressNow, setProgressNow] = useState(Date.now());
  const progressIdentity = `${session?.id ?? ""}:${session?.version ?? ""}`;
  const currentProgressIdentity = useRef(progressIdentity);
  currentProgressIdentity.current = progressIdentity;
  const checkProgress = useCallback(async () => {
    if (progressRequest.current) return;
    const identity = currentProgressIdentity.current;
    progressRequest.current = true;
    setCheckingProgress(true);
    try {
      const next = await prepaid<ExtractionProgress>("/workspace/extractions");
      if (mounted.current && identity === currentProgressIdentity.current) {
        setProgress(next);
        setProgressError("");
      }
    } catch (e) {
      if (mounted.current && identity === currentProgressIdentity.current)
        setProgressError((e as Error).message);
    } finally {
      progressRequest.current = false;
      if (mounted.current) setCheckingProgress(false);
    }
  }, []);
  useEffect(() => {
    setProgress(null);
    setProgressError("");
  }, [progressIdentity]);
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await checkProgress();
      if (!stopped) timer = setTimeout(poll, 5000);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pending, session?.id, checkProgress]);
  useEffect(() => {
    if (!processing) return;
    setProgressNow(Date.now());
    const timer = setInterval(() => setProgressNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [processing]);
  return {
    setProgress,
    progress,
    progressError,
    checkingProgress,
    progressNow,
    checkProgress,
    setProgressError,
  };
}
