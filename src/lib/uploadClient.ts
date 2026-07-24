import type { UploadDto } from "../../shared/api";
import { ApiClientError, getAccessToken } from "./apiClient";
import { createUploadId } from "./uploadId";
import { sanitizeFileName } from "./utils";
import type { UploadQueueItem } from "./uploadState";

const MAX_UPLOAD_BYTES = 4_500_000;
const ALLOWED_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/zip", "application/msword", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function validateUploadFile(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) return `Exceeds ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB upload limit.`;
  if (!ALLOWED_TYPES.has(file.type)) return "File type is not allowed for this portal.";
  if (file.size <= 0) return "Empty files are not allowed.";
  return null;
}

export function validateWorkflowFile(file: File, allowedTypes?: readonly string[]) {
  return allowedTypes && !allowedTypes.includes(file.type) ? "This workflow accepts Excel (.xlsx) files only." : null;
}

function parseError(text: string, status: number) {
  try {
    const payload = JSON.parse(text) as { error?: { code?: string; message?: string } };
    return new ApiClientError(status, payload.error?.code ?? "UPLOAD_FAILED", payload.error?.message ?? `Upload failed with status ${status}.`);
  } catch {
    return new ApiClientError(status, "UPLOAD_FAILED", text || `Upload failed with status ${status}.`);
  }
}

export function uploadFileThroughApi(item: UploadQueueItem, workflow: "prepaid" | "memo" | "aprm", onProgress: (progress: number) => void, slot?: string): Promise<{ upload: UploadDto }> {
  const token = getAccessToken();
  if (!token) return Promise.reject(new Error("Your session has expired. Please sign in again."));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.responseType = "text";
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.max(1, Math.min(98, Math.round((event.loaded / event.total) * 98))));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const payload = JSON.parse(xhr.responseText) as { upload?: UploadDto };
          if (!payload.upload) throw new Error("unexpected response");
          onProgress(100);
          resolve({ upload: payload.upload });
        } catch {
          reject(new Error("The API returned an invalid upload response."));
        }
        return;
      }
      reject(parseError(xhr.responseText, xhr.status));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    const body = new FormData();
    body.append("workflow", workflow);
    if (slot) body.append("slot", slot);
    body.append("file", item.file, item.file.name);
    xhr.send(body);
  });
}

export async function uploadSingleFile(file: File, onProgress: (progress: number) => void, workflow: "prepaid" | "memo" | "aprm", slot?: string) {
  const rejection = validateUploadFile(file);
  if (rejection) throw new Error(rejection);
  const item: UploadQueueItem = { id: createUploadId(), file: new File([file], sanitizeFileName(file.name), { type: file.type }), status: "queued", progress: 0 };
  const response = await uploadFileThroughApi(item, workflow, onProgress, slot);
  return { ...item, id: response.upload.id, status: "success" as const, progress: 100, objectKey: response.upload.objectKey };
}
