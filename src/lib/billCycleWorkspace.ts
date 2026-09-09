import type { ProcessingPipelineFileDto } from "./apiTypes";

export type BillCycleGroup = {
  cycle: string;
  files: ProcessingPipelineFileDto[];
  latestUploadAt: string | null;
};

export type BillCycleUploadValidation =
  | { valid: true; uploads: Array<{ file: File; expected: ProcessingPipelineFileDto }> }
  | { valid: false; message: string };

export function groupFilesByBillCycle(files: readonly ProcessingPipelineFileDto[]): BillCycleGroup[] {
  const groups = new Map<string, ProcessingPipelineFileDto[]>();

  for (const file of files) {
    const cycle = file.stepFunction?.batchCycle;
    if (!cycle) continue;
    groups.set(cycle, [...(groups.get(cycle) ?? []), file]);
  }

  return [...groups.entries()]
    .map(([cycle, cycleFiles]) => ({
      cycle,
      files: [...cycleFiles].sort((left, right) => left.expectedFileName.localeCompare(right.expectedFileName)),
      latestUploadAt: latestUploadAt(cycleFiles),
    }))
    .sort((left, right) => compareCycles(right.cycle, left.cycle));
}

export function validateBillCycleUpload(
  expectedFiles: readonly ProcessingPipelineFileDto[],
  selectedFiles: readonly File[],
): BillCycleUploadValidation {
  if (!expectedFiles.length) return { valid: false, message: "This bill cycle has no configured file requirements." };
  if (!selectedFiles.length) return { valid: false, message: "Choose at least one file for the selected bill cycle." };

  // Windows and most spreadsheet applications do not preserve the casing of a
  // file extension. Match names case-insensitively, but always send the
  // canonical configured filename to the API as the assignment key.
  const expectedByName = new Map(expectedFiles.map((file) => [normalizeFileName(file.expectedFileName), file]));
  const selectedByName = new Map<string, File>();

  for (const file of selectedFiles) {
    const normalizedName = normalizeFileName(file.name);
    if (selectedByName.has(normalizedName)) return { valid: false, message: `Duplicate file selected: ${file.name}.` };
    if (!expectedByName.has(normalizedName)) return { valid: false, message: `${file.name} is not required for this bill cycle.` };
    selectedByName.set(normalizedName, file);
  }

  return {
    valid: true,
    uploads: expectedFiles
      .filter((expected) => selectedByName.has(normalizeFileName(expected.expectedFileName)))
      .map((expected) => ({ file: selectedByName.get(normalizeFileName(expected.expectedFileName))!, expected })),
  };
}

function normalizeFileName(fileName: string) {
  return fileName.toLocaleLowerCase();
}

export function formatBillCycleUploadDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function latestUploadAt(files: readonly ProcessingPipelineFileDto[]) {
  const dates = files
    .map((file) => file.lastModified)
    .filter((value): value is string => Boolean(value) && !Number.isNaN(Date.parse(value!)));

  return dates.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function compareCycles(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return left.localeCompare(right, undefined, { numeric: true });
}
