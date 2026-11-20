export type ExtractionProgress = {
  expectedWorkflows?: string[];
  preparation: {
    id: string;
    status: string;
    created_at: string;
    error?: string | null;
    available_at?: string;
  } | null;
  executions: {
    workflow: string;
    status: string;
    preparation_id: string;
    created_at?: string;
    error?: string | null;
  }[];
};
export const workflowLabels: Record<string, string> = {
  ke24: "Revenue report",
  callcard_eg: "EG Call Card",
  callcard_sg: "SG Call Card",
  load_up_eg: "EG Load Up",
  load_up_sg: "SG Load Up",
  load_api_eg: "EG Load API",
  load_api_sg: "SG Load API",
  monthly_recharge: "Monthly recharge",
  adjustments_308: "Billed adjustments (308)",
  charges_318: "Billed charges (318)",
};
export function extractionStatus(progress: ExtractionProgress | null) {
  const rows =
    progress?.executions?.filter(
      (row) =>
        row.preparation_id === progress.preparation?.id &&
        (!progress.expectedWorkflows ||
          progress.expectedWorkflows.includes(row.workflow)),
    ) ?? [];
  const completed = new Set(
    rows.filter((row) => row.status === "completed").map((row) => row.workflow),
  ).size;
  const total = progress?.expectedWorkflows?.length ?? (progress ? 10 : 0);
  return {
    rows,
    completed,
    total,
    finalizing: total > 0 && completed === total,
  };
}
export function elapsedTime(start: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
