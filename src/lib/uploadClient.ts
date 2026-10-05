export function validateWorkflowFile(
  file: File,
  allowedTypes?: readonly string[],
) {
  return allowedTypes && !allowedTypes.includes(file.type)
    ? "This workflow accepts Excel (.xlsx) files only."
    : null;
}
