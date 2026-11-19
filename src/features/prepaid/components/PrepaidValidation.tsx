import {
  prepaidValidationMessage,
  isPrepaidReviewFinding,
  prepaidReconciliationDifferences,
} from "../../../lib/prepaidValidation";
import { formatMoney, type Layout } from "../../../lib/prepaidApi";

export function PrepaidValidation({
  validation,
  frozen = false,
  onReview,
}: {
  validation: Layout["validation"];
  frozen?: boolean;
  onReview?: (variant: "mt" | "bb") => void;
}) {
  if (validation?.valid && !validation.findings.length) return null;
  const findings = validation?.findings ?? [];
  const warnings = findings.filter(isPrepaidReviewFinding);
  const errors = findings.filter((finding) => !isPrepaidReviewFinding(finding));
  const blocked = validation?.valid === false;
  const differences = findings.flatMap(prepaidReconciliationDifferences);
  const list = (items: unknown[]) => (
    <ul>
      {items.map((finding, index) => (
        <li key={index}>{prepaidValidationMessage(finding)}</li>
      ))}
    </ul>
  );
  const comparison = !!differences.length && (
    <div className="pp-table-scroll pp-validation-differences">
      <table className="pp-table" aria-label="Allocation differences">
        <caption>Difference = layout total − allocated total.</caption>
        <colgroup>
          <col className="pp-difference-label" />
          <col span={3} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">REVENUE TYPE</th>
            <th scope="col" className="pp-number">
              LAYOUT TOTAL
            </th>
            <th scope="col" className="pp-number">
              ALLOCATED TOTAL
            </th>
            <th scope="col" className="pp-number">
              DIFFERENCE
            </th>
          </tr>
        </thead>
        <tbody>
          {differences.map((detail, row) => (
            <tr key={`${detail.revenueType}-${row}`}>
              <td>
                {onReview ? (
                  <button
                    className="pp-link"
                    onClick={() =>
                      onReview(detail.revenueType.endsWith("_BB") ? "bb" : "mt")
                    }
                  >
                    {detail.revenueType.replaceAll("_", " ")}
                  </button>
                ) : (
                  detail.revenueType.replaceAll("_", " ")
                )}
              </td>
              <td className="pp-number">
                {formatMoney(detail.expectedGross, 2)}
              </td>
              <td className="pp-number">
                {formatMoney(detail.allocatedGross, 2)}
              </td>
              <td className="pp-number">{formatMoney(detail.difference, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div
      className={`pp-validation${validation?.valid ? " pp-validation-notes" : ""}`}
      role={blocked ? "alert" : "status"}
    >
      {!validation && (
        <>
          <strong>Check the layout</strong>
          <p>Save your changes to check the amounts before freezing.</p>
        </>
      )}
      {(!!errors.length || blocked) && (
        <>
          <strong>Resolve before freezing</strong>
          {errors.length ? (
            list(errors)
          ) : (
            <p>
              Some checks have not passed. Refresh the workspace. If this
              continues, ask your accounting administrator to review this run.
            </p>
          )}
        </>
      )}
      {!!warnings.length && (
        <>
          <strong>
            {frozen ? "Allocation details" : "Check before freezing"}
          </strong>
          {!frozen && (
            <p>Review the items below before freezing this layout.</p>
          )}
          {list(warnings)}
        </>
      )}
      {comparison}
      {!!findings.length && onReview && (
        <button className="pp-outline" onClick={() => onReview("mt")}>
          Review allocation
        </button>
      )}
    </div>
  );
}
