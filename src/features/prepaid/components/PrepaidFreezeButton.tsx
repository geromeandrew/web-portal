import { CheckCheck } from "lucide-react";
import { useId } from "react";

export function PrepaidFreezeButton({
  reason,
  onClick,
}: {
  reason: string;
  onClick: () => void;
}) {
  const tooltipId = useId();
  return (
    <span
      className="pp-freeze-control"
      role={reason ? "group" : undefined}
      tabIndex={reason ? 0 : undefined}
      aria-label={reason ? "Freeze unavailable" : undefined}
      aria-describedby={reason ? tooltipId : undefined}
    >
      <button
        type="button"
        className="pp-primary"
        disabled={!!reason}
        aria-describedby={reason ? tooltipId : undefined}
        onClick={onClick}
      >
        <CheckCheck size={16} aria-hidden="true" />
        Freeze
      </button>
      {reason && <span id={tooltipId} className="pp-freeze-tooltip" role="tooltip">{reason}</span>}
    </span>
  );
}
