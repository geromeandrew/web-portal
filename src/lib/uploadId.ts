/**
 * Creates an identifier for temporary browser-side upload queue state.
 */
export function createUploadId() {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function") return randomUuid.call(globalThis.crypto);

  return `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
