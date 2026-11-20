import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { PrepaidValidation } from "../src/features/prepaid/components/PrepaidValidation";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const warnings = [
  {
    code: "REFERENCE_MAPPING_AMBIGUOUS",
    severity: "warning",
    policy: "legacy_all_matches",
  },
  {
    code: "AVERAGE_RATE_ZERO",
    severity: "warning",
    policy: "legacy_all_matches",
  },
  {
    code: "RECONCILIATION_DIFFERENCE",
    severity: "warning",
    policy: "legacy_all_matches",
    basis: "legacy_threshold_and_rounding",
    details: [
      {
        revenueType: "GP_EG_MT",
        expectedGross: "21980074.81",
        allocatedGross: "21982415.41",
        difference: "-2340.60",
      },
      {
        revenueType: "GP_EG_BB",
        expectedGross: "0.01",
        allocatedGross: "0.00",
        difference: "0.01",
      },
    ],
  },
];
it("presents production actions and exact amounts without raw codes or developer explanations", async () => {
  const onReview = vi.fn();
  await act(async () =>
    root.render(
      <PrepaidValidation
        validation={{ valid: true, findings: warnings }}
        onReview={onReview}
      />,
    ),
  );
  expect(container.textContent).toContain("Check before freezing");
  expect(container.textContent).toContain("21,980,074.81");
  expect(container.textContent).toContain("21,982,415.41");
  expect(container.textContent).toContain("-2,340.60");
  expect(container.textContent).not.toMatch(
    /legacy|REFERENCE_MAPPING|AVERAGE_RATE_ZERO|RECONCILIATION_DIFFERENCE|Details for support|does not block|source basis/i,
  );
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "Review allocation")!
      .click(),
  );
  expect(onReview).toHaveBeenLastCalledWith("mt");
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "GP EG BB")!
      .click(),
  );
  expect(onReview).toHaveBeenLastCalledWith("bb");
});
it("keeps blocking findings prominent even when review notes are present", async () => {
  await act(async () =>
    root.render(
      <PrepaidValidation
        validation={{
          valid: false,
          findings: [...warnings, { code: "JV_NOT_BALANCED" }],
        }}
      />,
    ),
  );
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Resolve before freezing",
  );
  expect(container.textContent).toContain(
    "journal debit and credit totals do not balance",
  );
});
it("does not tell users to freeze an already frozen layout", async () => {
  await act(async () =>
    root.render(
      <PrepaidValidation
        frozen
        validation={{ valid: true, findings: warnings }}
      />,
    ),
  );
  expect(container.textContent).toContain("Allocation details");
  expect(container.textContent).not.toContain("before freezing");
});
it("gives a recovery instruction when validation fails without readable findings", async () => {
  await act(async () =>
    root.render(
      <PrepaidValidation validation={{ valid: false, findings: [] }} />,
    ),
  );
  expect(container.textContent).toContain("Some checks have not passed");
});
