export function memoUploadIdentity(name: string) {
  if (/[\\/\0]/.test(name)) return null;
  const match = /^(.+)_([^_]+)\.xlsx$/i.exec(
    name.replace(/(?:\.xlsx){2,}$/i, ".xlsx"),
  );
  return match && match[2].trim()
    ? { base: match[1].toLowerCase(), suffix: match[2].toLowerCase() }
    : null;
}

export function matchesMemoUpload(expected: string, original: string) {
  const mapped = memoUploadIdentity(expected);
  const uploaded = memoUploadIdentity(original);
  return Boolean(mapped && uploaded && mapped.base === uploaded.base);
}
