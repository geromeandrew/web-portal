import { AlertCircle, Check, LoaderCircle } from "lucide-react";

export function PrepaidProgressStrip({
  state,
  title,
  detail,
  action,
  onAction,
}: {
  state: "active" | "complete" | "failed";
  title: string;
  detail?: string;
  action: string;
  onAction: () => void;
}) {
  const Icon = state === "active" ? LoaderCircle : state === "complete" ? Check : AlertCircle;
  return (
    <section className={`pp-progress-strip pp-progress-strip-${state}`} aria-label="Processing status">
      <Icon size={20} className={state === "active" ? "pp-spinner" : undefined} aria-hidden="true" />
      <div className="pp-progress-strip-copy" role={state === "failed" ? "alert" : "status"}>
        <strong>{title}</strong>
        {detail && <p>{detail}</p>}
      </div>
      <button type="button" className="pp-outline" onClick={onAction}>{action}</button>
    </section>
  );
}
