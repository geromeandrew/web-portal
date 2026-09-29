import type { ProcessingPipelineFileDto } from "../src/lib/apiTypes";
import { formatBillCycleUploadDate, formatBillCycleUploadTimestamp, groupFilesByBillCycle, sortBillCyclesAscending, validateBillCycleUpload } from "../src/lib/billCycleWorkspace";

const file = (name: string, cycle: string, lastModified: string | null = null): ProcessingPipelineFileDto => ({
  id: `${cycle}-${name}`,
  expectedFileName: name,
  matchedFileName: lastModified ? name : null,
  legacyPackageName: null,
  jobName: null,
  availability: lastModified ? "present" : "missing",
  key: null,
  size: null,
  lastModified,
  stepFunction: { stateMachineName: "bill-cycle", batchCycle: cycle, executionInput: {} },
});

describe("bill-cycle workspace data", () => {
  it("groups files by cycle, sorts activity by the newest upload, and uses the newest upload date", () => {
    const groups = groupFilesByBillCycle([
      file("cycle-08.xlsx", "08", "2026-09-01T00:00:00.000Z"),
      file("cycle-11-b.xlsx", "11", "2026-09-03T00:00:00.000Z"),
      file("cycle-11-a.xlsx", "11", "2026-09-02T00:00:00.000Z"),
      file("cycle-24.xlsx", "24", "2026-09-04T00:00:00.000Z"),
      { ...file("308. Billed Adjustments Monthly Summary Report_I_06.XLSX", "06"), stepFunction: null },
      { ...file("unmapped.xlsx", "00"), stepFunction: null },
    ]);

    expect(groups.map((group) => group.cycle)).toEqual(["24", "11", "08", "06"]);
    expect(groups[1].latestUploadAt).toBe("2026-09-03T00:00:00.000Z");
    expect(groups[1].files.map((item) => item.expectedFileName)).toEqual(["cycle-11-a.xlsx", "cycle-11-b.xlsx"]);
    expect(formatBillCycleUploadDate(groups[1].latestUploadAt)).toBe("Sep 3, 2026");
    expect(formatBillCycleUploadTimestamp(groups[1].latestUploadAt)).not.toMatch(/\b(?:GMT|UTC|PST|PDT|EST|EDT|CST|CDT|SGT)\b/);
    expect(sortBillCyclesAscending(groups).map((group) => group.cycle)).toEqual(["06", "08", "11", "24"]);
    expect(formatBillCycleUploadDate(null)).toBe("—");
  });

  it("allows a subset of expected files while rejecting duplicate and unexpected files", () => {
    const expected = [file("308.xlsx", "11"), file("318.xlsx", "11")];

    expect(validateBillCycleUpload(expected, [new File(["308"], "308.xlsx")])).toMatchObject({ valid: true });
    expect(validateBillCycleUpload(expected, [new File(["308"], "308.xlsx"), new File(["copy"], "308.xlsx")])).toMatchObject({ valid: false, message: expect.stringContaining("Duplicate") });
    expect(validateBillCycleUpload(expected, [new File(["308"], "308.xlsx"), new File(["extra"], "extra.xlsx")])).toMatchObject({ valid: false, message: expect.stringContaining("not required") });
    expect(validateBillCycleUpload(expected, [new File(["308"], "308.xlsx"), new File(["318"], "318.xlsx")])).toMatchObject({ valid: true });
  });

  it("accepts expected filenames with a differently cased extension", () => {
    const expected = [file("411. Bill Control_PHP_B_27.XLSX", "27")];

    expect(validateBillCycleUpload(expected, [new File(["411"], "411. Bill Control_PHP_B_27.xlsx")])).toMatchObject({ valid: true });
  });

  it("accepts relaxed bill-cycle filenames while retaining report identity", () => {
    const expected = [file("308. Billed Adjustments Monthly Summary Report_B_01.XLSX", "01"), file("411. Bill Control_PHP_B_01.XLSX", "01")];
    expect(validateBillCycleUpload(expected, [new File(["308"], "308. corrected title_b_01.xlsx")])).toMatchObject({ valid: true });
    expect(validateBillCycleUpload(expected, [new File(["411"], "411. corrected title_usd_b_01.xlsx")])).toMatchObject({ valid: false });
  });

  it("explains when a 411 Bill Control filename omits its currency", () => {
    const expected = [file("411. Bill Control_PHP_B_01.XLSX", "01")];

    expect(validateBillCycleUpload(expected, [new File(["411"], "411. Bill Control_B_01.xlsx")])).toEqual({
      valid: false,
      message: "411 Bill Control files must include either PHP or USD in the filename.",
    });
  });

  it("uses the selected workspace and cycle when a valid upload filename has omitted or conflicting suffixes", () => {
    const expected = [file("308. Billed Adjustments Monthly Summary Report_B_27.XLSX", "27")];

    expect(validateBillCycleUpload(expected, [new File(["308"], "308. revised title_b.xlsx")])).toMatchObject({
      valid: true,
      uploads: [{ expected: expect.objectContaining({ expectedFileName: "308. Billed Adjustments Monthly Summary Report_B_27.XLSX" }) }],
    });
    expect(validateBillCycleUpload(expected, [new File(["308"], "308.xlsx")])).toMatchObject({ valid: true });
    expect(validateBillCycleUpload(expected, [new File(["308"], "308. revised title_27.xlsx")])).toMatchObject({ valid: true });
    expect(validateBillCycleUpload(expected, [new File(["308"], "308. revised title_g_27.xlsx")])).toMatchObject({
      valid: true,
      uploads: [{ expected: expect.objectContaining({ expectedFileName: "308. Billed Adjustments Monthly Summary Report_B_27.XLSX" }) }],
    });
    expect(validateBillCycleUpload(expected, [new File(["308"], "308. revised title_b_24.xlsx")])).toMatchObject({
      valid: true,
      uploads: [{ expected: expect.objectContaining({ expectedFileName: "308. Billed Adjustments Monthly Summary Report_B_27.XLSX" }) }],
    });
  });
});
