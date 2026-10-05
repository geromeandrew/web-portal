import type { ProcessingPipelineFileDto } from "./apiTypes";

export type BillCycleGroup = {
  cycle: string;
  files: ProcessingPipelineFileDto[];
  latestUploadAt: string | null;
};

export type BillCycleUploadValidation =
  | {
      valid: true;
      uploads: Array<{ file: File; expected: ProcessingPipelineFileDto }>;
    }
  | { valid: false; message: string };

export function groupFilesByBillCycle(
  files: readonly ProcessingPipelineFileDto[],
): BillCycleGroup[] {
  const groups = new Map<string, ProcessingPipelineFileDto[]>();

  for (const file of files) {
    // Innove has the same bill-cycle file naming convention but no Step
    // Functions mapping. A missing execution mapping must not hide a valid
    // upload requirement from the Bill Cycle workspace.
    const cycle =
      file.stepFunction?.batchCycle ??
      file.expectedFileName.match(/_(\d{2})(?=\.[^.]+$)/)?.[1];
    if (!cycle) continue;
    groups.set(cycle, [...(groups.get(cycle) ?? []), file]);
  }

  return [...groups.entries()]
    .map(([cycle, cycleFiles]) => ({
      cycle,
      files: [...cycleFiles].sort((left, right) =>
        left.expectedFileName.localeCompare(right.expectedFileName),
      ),
      latestUploadAt: latestUploadAt(cycleFiles),
    }))
    .sort(compareBillCycleActivity);
}

export function sortBillCyclesAscending(groups: readonly BillCycleGroup[]) {
  return [...groups].sort((left, right) =>
    compareCycles(left.cycle, right.cycle),
  );
}

export function validateBillCycleUpload(
  expectedFiles: readonly ProcessingPipelineFileDto[],
  selectedFiles: readonly File[],
): BillCycleUploadValidation {
  if (!expectedFiles.length)
    return {
      valid: false,
      message: "This bill cycle has no configured file requirements.",
    };
  if (!selectedFiles.length)
    return {
      valid: false,
      message: "Choose at least one file for the selected bill cycle.",
    };

  // Windows and most spreadsheet applications do not preserve the casing of a
  const selectedByExpectedName = new Map<string, File>();

  for (const file of selectedFiles) {
    const normalizedName = normalizeFileName(file.name);
    if (
      [...selectedByExpectedName.values()].some(
        (selected) => normalizeFileName(selected.name) === normalizedName,
      )
    )
      return {
        valid: false,
        message: `Duplicate file selected: ${file.name}.`,
      };
    if (is411BillControlFileMissingCurrency(file.name))
      return {
        valid: false,
        message:
          "411 Bill Control files must include either PHP or USD in the filename.",
      };
    const expected = expectedFiles.filter(
      (candidate) =>
        normalizeFileName(candidate.expectedFileName) === normalizedName ||
        matchesBillCycleUploadFile(candidate.expectedFileName, file.name),
    );
    if (!expected.length)
      return {
        valid: false,
        message: `${file.name} is not required for this bill cycle.`,
      };
    if (expected.length > 1)
      return {
        valid: false,
        message: `${file.name} matches more than one required bill-cycle file.`,
      };
    if (selectedByExpectedName.has(expected[0].expectedFileName))
      return {
        valid: false,
        message: `Duplicate file selected for ${expected[0].expectedFileName}.`,
      };
    selectedByExpectedName.set(expected[0].expectedFileName, file);
  }

  return {
    valid: true,
    uploads: expectedFiles
      .filter((expected) =>
        selectedByExpectedName.has(expected.expectedFileName),
      )
      .map((expected) => ({
        file: selectedByExpectedName.get(expected.expectedFileName)!,
        expected,
      })),
  };
}

function normalizeFileName(fileName: string) {
  return fileName.toLocaleLowerCase();
}

function is411BillControlFileMissingCurrency(fileName: string) {
  return (
    /^411(?:[.\s_-]|$)/i.test(fileName) &&
    !/(?:^|[^a-z0-9])(php|usd)(?:[^a-z0-9]|$)/i.test(fileName)
  );
}

export function matchesBillCycleUploadFile(
  expectedFileName: string,
  fileName: string,
) {
  const expected = billCycleFileIdentity(expectedFileName);
  const uploaded = billCycleFileIdentity(fileName);
  // The selected workspace and Bill Cycle determine the canonical storage
  // name, so supplied entity and cycle suffixes are intentionally ignored.
  return Boolean(expected && uploaded && expected.report === uploaded.report);
}

function billCycleFileIdentity(fileName: string) {
  const suffix = fileName.match(/(?:_([BGI]))?(?:_(\d{2}))?(?=\.[^.]+$)/i);
  const entity = suffix?.[1]?.toUpperCase() ?? null;
  const cycle = suffix?.[2] ?? null;
  const prefix = fileName.match(/^(\d+)/)?.[1];
  if (prefix) {
    const controlType =
      prefix === "411"
        ? /(?:^|[^a-z0-9])(php|usd)(?:[^a-z0-9]|$)/i
            .exec(fileName)?.[1]
            ?.toUpperCase()
        : null;
    if (prefix === "411" && !controlType) return null;
    return {
      report: controlType ? `${prefix}:${controlType}` : prefix,
      entity,
      cycle,
    };
  }
  if (/sap/i.test(fileName) && /glbilled/i.test(fileName))
    return { report: "SAP_GLBILLED", entity, cycle };
  return null;
}

export function formatBillCycleUploadDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatBillCycleUploadTimestamp(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function latestUploadAt(files: readonly ProcessingPipelineFileDto[]) {
  const dates = files
    .map((file) => file.uploadedAt ?? file.lastModified)
    .filter(
      (value): value is string =>
        Boolean(value) && !Number.isNaN(Date.parse(value!)),
    );

  return (
    dates.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null
  );
}

function compareCycles(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber))
    return leftNumber - rightNumber;
  return left.localeCompare(right, undefined, { numeric: true });
}

function compareBillCycleActivity(left: BillCycleGroup, right: BillCycleGroup) {
  const leftTime = left.latestUploadAt
    ? Date.parse(left.latestUploadAt)
    : Number.NaN;
  const rightTime = right.latestUploadAt
    ? Date.parse(right.latestUploadAt)
    : Number.NaN;
  const leftHasUpload = Number.isFinite(leftTime);
  const rightHasUpload = Number.isFinite(rightTime);

  if (leftHasUpload && rightHasUpload && leftTime !== rightTime)
    return rightTime - leftTime;
  if (leftHasUpload !== rightHasUpload) return leftHasUpload ? -1 : 1;
  return compareCycles(right.cycle, left.cycle);
}
