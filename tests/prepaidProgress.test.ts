import { expect, it } from "vitest";
import { elapsedTime, extractionStatus } from "../src/lib/prepaidProgress";

it("counts only expected workflows for the active preparation", () => {
  const result = extractionStatus({
    preparation: {
      id: "new",
      status: "running",
      created_at: "2026-10-30T00:00:00Z",
    },
    expectedWorkflows: ["ke24", "callcard_eg"],
    executions: [
      { workflow: "ke24", status: "completed", preparation_id: "old" },
      { workflow: "ke24", status: "completed", preparation_id: "new" },
      { workflow: "charges_318", status: "completed", preparation_id: "new" },
      { workflow: "callcard_eg", status: "waiting", preparation_id: "new" },
    ],
  });
  expect(result.completed).toBe(1);
  expect(result.total).toBe(2);
  expect(result.finalizing).toBe(false);
  expect(result.rows.map((row) => row.workflow)).toEqual([
    "ke24",
    "callcard_eg",
  ]);
});
it("does not invent progress before loading and keeps elapsed time nonnegative", () => {
  expect(extractionStatus(null)).toMatchObject({
    completed: 0,
    total: 0,
    finalizing: false,
  });
  expect(elapsedTime(2000, 1000)).toBe("00:00");
  expect(elapsedTime(0, 2220000)).toBe("37:00");
});
