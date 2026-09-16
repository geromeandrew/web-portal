import type { ProcessingPipelineFileDto } from "../src/lib/apiTypes";
import { formatBillCycleUploadDate, groupFilesByBillCycle, validateBillCycleUpload } from "../src/lib/billCycleWorkspace";

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
  it("groups files by cycle, sorts recent cycles first, and uses the newest upload", () => {
    const groups = groupFilesByBillCycle([
      file("cycle-08.xlsx", "08", "2026-09-01T00:00:00.000Z"),
      file("cycle-11-b.xlsx", "11", "2026-09-03T00:00:00.000Z"),
      file("cycle-11-a.xlsx", "11", "2026-09-02T00:00:00.000Z"),
      { ...file("unmapped.xlsx", "00"), stepFunction: null },
    ]);

    expect(groups.map((group) => group.cycle)).toEqual(["11", "08"]);
    expect(groups[0].latestUploadAt).toBe("2026-09-03T00:00:00.000Z");
    expect(groups[0].files.map((item) => item.expectedFileName)).toEqual(["cycle-11-a.xlsx", "cycle-11-b.xlsx"]);
    expect(formatBillCycleUploadDate(groups[0].latestUploadAt)).toBe("Sep 3, 2026");
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
});
