import { useEffect, useState } from "react";
import { prepaid, type Report } from "../../../lib/prepaidApi";
import type { Modal } from "../types";

/** Fetch history only while its dialog is open; ignore responses after navigation. */
export function usePrepaidHistory(modal: Modal) {
  const [historyDate, setHistoryDate] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyAttempt, setHistoryAttempt] = useState(0);
  useEffect(() => {
    if (modal !== "history") return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError("");
    setReports([]);
    void prepaid<{ rows: Report[]; hasMore: boolean }>(
      `/report-history?limit=25&offset=${historyOffset}${historyDate ? `&date=${historyDate}` : ""}`,
    )
      .then((data) => {
        if (!cancelled) {
          setReports(data.rows);
          setHasMore(data.hasMore);
        }
      })
      .catch((e) => {
        if (!cancelled) setHistoryError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modal, historyDate, historyOffset, historyAttempt]);
  return {
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
  };
}
