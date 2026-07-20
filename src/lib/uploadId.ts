/**
 * Creates an identifier for browser-side upload state and the Lambda upload
 * header. `crypto.randomUUID` is unavailable on HTTP origins, so retain a
 * non-secret fallback for the temporary HTTP deployment.
 */
export function createUploadId() {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function") return randomUuid.call(globalThis.crypto);

  return `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
