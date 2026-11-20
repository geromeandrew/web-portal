type Finding = Record<string, unknown>;

function findingRecord(value: unknown): Finding {
  return value !== null && typeof value === "object" ? (value as Finding) : {};
}

/** Presentation only. Freeze eligibility is decided by backend validation. */
export function prepaidValidationMessage(finding: unknown): string {
  const item = findingRecord(finding);
  const code = typeof finding === "string" ? finding : item.code;
  if (item.severity === "warning" && item.policy === "legacy_all_matches") {
    if (code === "REFERENCE_MAPPING_AMBIGUOUS")
      return "Some products match more than one reference rate. Review their rates and quantities in the allocation breakdown. If a rate is unexpected, ask your accounting administrator to verify it.";
    if (code === "AVERAGE_RATE_ZERO")
      return "Some entries have a zero reference rate, so their calculated quantity is zero. Their amounts are still included. Ask your accounting administrator to confirm these entries.";
    if (
      code === "RECONCILIATION_DIFFERENCE" &&
      item.basis === "legacy_threshold_and_rounding"
    )
      return "The allocation rules exclude very small or negative shares and round the amounts. Ask your accounting reviewer to confirm whether the differences below are expected.";
  }

  const count =
    typeof item.count === "number" ? ` (${item.count} entries)` : "";
  const messages: Record<string, string> = {
    REFERENCE_MAPPING_MISSING: `Some entries have no matching accounting reference${count}. Ask your accounting administrator to check the reference data.`,
    REFERENCE_MAPPING_AMBIGUOUS:
      "Some products have conflicting reference rates. Ask your accounting administrator to confirm the correct rates before freezing.",
    AVERAGE_RATE_ZERO:
      "Some amounts cannot be converted to quantities because the reference rate is zero. Ask your accounting administrator to verify the rate before freezing.",
    RECONCILIATION_DIFFERENCE:
      "Allocation totals do not match the layout totals. Review the allocation breakdown and any edited splits. Resolve the difference before freezing.",
    ALLOCATION_BASE_MISSING_OR_ZERO:
      "Some layout amounts have no revenue available for allocation. Check the revenue report and ask your accounting administrator to verify the reference data.",
    LAYOUT_VARIANCE:
      "The reclassification does not balance. Check your edited amounts and splits until the layout variance is zero.",
    JV_NOT_BALANCED:
      "The journal debit and credit totals do not balance. Resolve the allocation and layout differences before freezing.",
  };
  return (
    (typeof code === "string" && Object.hasOwn(messages, code)
      ? messages[code]
      : undefined) ??
    "The results need checking. Ask your accounting administrator to review this run before freezing."
  );
}

export function isPrepaidReviewFinding(finding: unknown) {
  return findingRecord(finding).severity === "warning";
}

export type ReconciliationDifference = {
  revenueType: string;
  expectedGross: string;
  allocatedGross: string;
  difference: string;
};

/** Preserve exact decimal strings; never display arbitrary diagnostic payloads. */
export function prepaidReconciliationDifferences(
  finding: unknown,
): ReconciliationDifference[] {
  const item = findingRecord(finding);
  if (item.code !== "RECONCILIATION_DIFFERENCE" || !Array.isArray(item.details))
    return [];
  return item.details.flatMap((value) => {
    const detail = findingRecord(value);
    const { revenueType, expectedGross, allocatedGross, difference } = detail;
    if (
      typeof revenueType !== "string" ||
      ![expectedGross, allocatedGross, difference].every(
        (value) => typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value),
      )
    )
      return [];
    return [
      {
        revenueType,
        expectedGross: expectedGross as string,
        allocatedGross: allocatedGross as string,
        difference: difference as string,
      },
    ];
  });
}
