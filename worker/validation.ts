import type { UploadCandidate } from "../shared/upload";
import { getAllowedMimeTypes, getMaxFileSizeBytes, type WorkerEnv } from "./config";

export function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export function validateCandidate(file: UploadCandidate, env: WorkerEnv) {
  const maxBytes = getMaxFileSizeBytes(env);
  const allowedMimeTypes = new Set(getAllowedMimeTypes(env));

  if (!file.name.trim()) {
    return "File name is required.";
  }

  if (file.size <= 0) {
    return "Empty files are not allowed.";
  }

  if (file.size > maxBytes) {
    return `File exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit.`;
  }

  if (!allowedMimeTypes.has(file.type)) {
    return `MIME type ${file.type || "unknown"} is not allowed.`;
  }

  return null;
}
