import { describe, expect, it } from "vitest";
import { matchesMemoUpload, memoUploadIdentity } from "../src/lib/memoUpload";

describe("Memo filename matching", () => {
  it.each([
    "NewProponent_20261023_2400.xlsx",
    "NewProponent_20261023_0160.xlsx",
    "NewProponent_20261023_999999.xlsx",
    "NewProponent_20261023_revision_A_final.xlsx",
    "NewProponent_20261023_.xlsx",
    "NewProponent_20261023.xlsx",
  ])("accepts a date with an unrestricted suffix: %s", (name) => {
    expect(matchesMemoUpload("NewProponent_01.XLSX", name)).toBe(true);
    expect(memoUploadIdentity(name)?.base).toBe("newproponent");
  });

  it.each([
    "Other_20261023_anything.xlsx",
    "NewProponent_20261023_anything.csv",
    "NewProponent_.xlsx",
  ])(
    "still rejects an incorrect base, extension or missing suffix: %s",
    (name) => {
      expect(matchesMemoUpload("NewProponent_01.XLSX", name)).toBe(false);
    },
  );
});
