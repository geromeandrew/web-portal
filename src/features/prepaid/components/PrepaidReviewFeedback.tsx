import { Check, LoaderCircle } from "lucide-react";

/** Feedback floats over the table edge without moving the layout or its cells. */
export function PrepaidReviewFeedback({
  saving,
  message,
}: {
  saving: boolean;
  message: string;
}) {
  if (!saving && !message) return null;
  return (
    <div
      id={saving ? "prepaid-save-status" : undefined}
      className={`pp-review-feedback ${saving ? "pp-review-feedback-saving" : "pp-review-feedback-saved"}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {saving ? (
        <LoaderCircle size={19} className="pp-spinner" aria-hidden="true" />
      ) : (
        <Check size={19} aria-hidden="true" />
      )}
      <span>
        {saving ? "Saving changes..." : message}
        {saving && (
          <span className="sr-only">
            {" "}
            Your layout totals are being updated. Please keep this page open.
          </span>
        )}
      </span>
    </div>
  );
}
