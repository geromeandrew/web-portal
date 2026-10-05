import {
  allocationHeaders,
  allocationRows,
  egLayoutRows,
  layoutHeaders,
  sgLayoutRows,
} from "../src/lib/demoData";

describe("Prepaid Re-Class table presentation", () => {
  it("omits legacy separator and metadata columns from layout tables", () => {
    expect(layoutHeaders).not.toContain("X");
    expect(layoutHeaders).not.toContain("Sort");
    expect(layoutHeaders).not.toContain("Tier");
    expect(layoutHeaders).toHaveLength(9);
    expect(egLayoutRows.every((row) => row.length === layoutHeaders.length)).toBe(true);
    expect(sgLayoutRows.every((row) => row.length === layoutHeaders.length)).toBe(true);
  });

  it("matches the reference allocation table column count", () => {
    expect(allocationHeaders).toHaveLength(10);
    expect(allocationHeaders).not.toContain("Allocation(%)");
    expect(allocationRows.every((row) => row.length === allocationHeaders.length)).toBe(true);
  });
});
