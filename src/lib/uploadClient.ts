export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export const UPLOAD_LIMIT_LABEL = "200 MB";

export function validateFileSize(file: Pick<File, "name" | "size">) {
  return file.size > MAX_UPLOAD_BYTES
    ? `${file.name} exceeds the ${UPLOAD_LIMIT_LABEL} per-file size limit.`
    : null;
}

export function validateWorkflowFile(
  file: File,
  allowedTypes?: readonly string[],
) {
  const sizeError = validateFileSize(file);
  if (sizeError) return sizeError;
  return allowedTypes && !allowedTypes.includes(file.type)
    ? "This workflow accepts Excel (.xlsx) files only."
    : null;
}
