import { describe, expect, it } from "vitest";
import {
  prepaidValidationMessage,
  prepaidReconciliationDifferences,
} from "../src/lib/prepaidValidation";
describe("Prepaid production validation messages", () => {
  it("explains the result and the accounting action without developer terminology", () => {
    expect(
      prepaidValidationMessage({
        code: "REFERENCE_MAPPING_AMBIGUOUS",
        severity: "warning",
        policy: "legacy_all_matches",
      }),
    ).toContain("Review their rates and quantities");
    expect(
      prepaidValidationMessage({
        code: "AVERAGE_RATE_ZERO",
        severity: "warning",
        policy: "legacy_all_matches",
      }),
    ).toContain("Their amounts are still included");
  });
  it("retains the strict warning for historical policies and the reconciliation error", () => {
    expect(prepaidValidationMessage({ code: "AVERAGE_RATE_ZERO" })).toContain(
      "verify the rate before freezing",
    );
    expect(
      prepaidValidationMessage({ code: "RECONCILIATION_DIFFERENCE" }),
    ).toContain("Resolve the difference before freezing");
  });
  it("only describes a reconciliation difference as explained with the verified legacy basis", () => {
    const finding = {
      code: "RECONCILIATION_DIFFERENCE",
      policy: "legacy_all_matches",
      severity: "warning",
    };
    expect(prepaidValidationMessage(finding)).toContain(
      "Resolve the difference before freezing",
    );
    expect(
      prepaidValidationMessage({
        ...finding,
        basis: "legacy_threshold_and_rounding",
      }),
    ).toContain("exclude very small or negative shares");
    expect(
      prepaidValidationMessage({
        code: "UNKNOWN",
        details: { private: "value" },
      }),
    ).not.toContain("private");
  });
  it("keeps raw codes and unexpected payloads out of production text", () => {
    for (const value of [
      "INTERNAL_ERROR",
      { code: "SOME_NEW_CODE" },
      null,
      { code: "constructor" },
    ])
      expect(prepaidValidationMessage(value)).toBe(
        "The results need checking. Ask your accounting administrator to review this run before freezing.",
      );
    expect(
      prepaidValidationMessage({ code: "REFERENCE_MAPPING_MISSING", count: 3 }),
    ).toContain("3 entries");
  });
  it("keeps exact decimal differences and rejects malformed diagnostic data", () => {
    const row = {
      revenueType: "GP_EG_MT",
      expectedGross: "12345678901234567890.01",
      allocatedGross: "12345678901234567890.02",
      difference: "-0.01",
    };
    expect(
      prepaidReconciliationDifferences({
        code: "RECONCILIATION_DIFFERENCE",
        details: [row, null, { private: "data" }],
      }),
    ).toEqual([row]);
    expect(
      prepaidReconciliationDifferences({
        code: "SOME_NEW_CODE",
        details: [row],
      }),
    ).toEqual([]);
  });
});
