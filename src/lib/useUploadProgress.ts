import { useCallback, useEffect, useState } from "react";

export type UploadEntry = {
  fileName: string;
  percent: number;
  status: "queued" | "uploading" | "uploaded" | "unconfirmed" | "not-started";
};
export type UploadProgress = {
  phase: "preparing" | "uploading" | "refreshing" | "complete" | "error";
  entries: UploadEntry[];
  error: string | null;
};

/** Estimates only the active request. Completion always comes from the server. */
export function useUploadProgress() {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  useEffect(() => {
    if (progress?.phase !== "uploading") return;
    const timer = window.setInterval(() => {
      setProgress((current) =>
        current?.phase === "uploading"
          ? {
              ...current,
              entries: current.entries.map((entry) =>
                entry.status === "uploading"
                  ? {
                      ...entry,
                      percent: Math.min(
                        90,
                        entry.percent +
                          Math.max(1, Math.ceil((90 - entry.percent) * 0.08)),
                      ),
                    }
                  : entry,
              ),
            }
          : current,
      );
    }, 500);
    return () => window.clearInterval(timer);
  }, [progress?.phase]);

  useEffect(() => {
    if (progress?.phase !== "complete") return;
    const timer = window.setTimeout(() => setProgress(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [progress?.phase]);

  const begin = useCallback(
    (names: string[]) =>
      setProgress({
        phase: "preparing",
        error: null,
        entries: names.map((fileName) => ({
          fileName,
          percent: 0,
          status: "queued",
        })),
      }),
    [],
  );
  const start = useCallback(
    (name: string) =>
      setProgress(
        (current) =>
          current && {
            ...current,
            phase: "uploading",
            entries: current.entries.map((entry) =>
              entry.fileName === name
                ? { ...entry, percent: 5, status: "uploading" }
                : entry,
            ),
          },
      ),
    [],
  );
  const uploaded = useCallback(
    (name: string) =>
      setProgress(
        (current) =>
          current && {
            ...current,
            entries: current.entries.map((entry) =>
              entry.fileName === name
                ? { ...entry, percent: 100, status: "uploaded" }
                : entry,
            ),
          },
      ),
    [],
  );
  const refresh = useCallback(
    (error: string | null = null) =>
      setProgress(
        (current) =>
          current && {
            ...current,
            phase: "refreshing",
            error,
            entries: current.entries.map((entry) =>
              entry.status === "uploading"
                ? { ...entry, status: "unconfirmed" }
                : entry.status === "queued"
                  ? { ...entry, status: "not-started" }
                  : entry,
            ),
          },
      ),
    [],
  );
  const finish = useCallback(
    (error: string | null = null) =>
      setProgress((current) => {
        if (!current) return current;
        const incomplete = current.entries.some(
          (entry) => entry.status !== "uploaded",
        );
        const message =
          error ??
          current.error ??
          (incomplete
            ? "Some files were not confirmed uploaded. Check activity before trying again."
            : null);
        return {
          ...current,
          phase: message ? "error" : "complete",
          error: message,
        };
      }),
    [],
  );
  const clear = useCallback(() => setProgress(null), []);
  return { progress, begin, start, uploaded, refresh, finish, clear };
}
