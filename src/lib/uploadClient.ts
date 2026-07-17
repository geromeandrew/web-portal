import type { LambdaUploadResponse } from "../../shared/upload";
import { sanitizeFileName } from "./utils";
import type { UploadQueueItem } from "./uploadState";

const MAX_LAMBDA_FILE_SIZE_BYTES = Number(import.meta.env.VITE_LAMBDA_MAX_FILE_SIZE_BYTES ?? 4_500_000);
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function getLambdaUploadBaseUrl() {
  const lambdaUploadUrl = import.meta.env.VITE_LAMBDA_UPLOAD_URL?.replace(/\/$/, "") ?? "";
  return import.meta.env.DEV && lambdaUploadUrl ? "/lambda-upload" : lambdaUploadUrl;
}

function isLambdaUploadResponse(value: unknown): value is LambdaUploadResponse {
  if (!value || typeof value !== "object") return false;
  const upload = (value as { upload?: unknown }).upload;
  return Boolean(upload && typeof upload === "object" && typeof (upload as { objectKey?: unknown }).objectKey === "string");
}

export function validateLambdaFile(file: File) {
  if (file.size > MAX_LAMBDA_FILE_SIZE_BYTES) {
    return `Exceeds ${Math.round(MAX_LAMBDA_FILE_SIZE_BYTES / 1024 / 1024)} MB Lambda upload limit.`;
  }
  if (!ALLOWED_TYPES.has(file.type)) return "File type is not allowed for this portal.";
  if (file.size <= 0) return "Empty files are not allowed.";
  return null;
}

export function validateWorkflowFile(file: File, allowedTypes?: readonly string[]) {
  return allowedTypes && !allowedTypes.includes(file.type)
    ? "This workflow accepts Excel (.xlsx) files only."
    : null;
}

export async function uploadFileThroughLambda(
  item: UploadQueueItem,
  onProgress: (progress: number) => void,
): Promise<LambdaUploadResponse> {
  const baseUrl = getLambdaUploadBaseUrl();
  if (!baseUrl) throw new Error("VITE_LAMBDA_UPLOAD_URL is not configured.");

  return new Promise<LambdaUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", baseUrl);
    xhr.responseType = "text";
    xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(item.file.name));
    xhr.setRequestHeader("X-File-Size", String(item.file.size));
    xhr.setRequestHeader("X-Upload-Id", item.id);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.max(1, Math.min(98, Math.round((event.loaded / event.total) * 98))));
    };

    xhr.onload = () => {
      const body = xhr.responseText;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(body) as unknown;
          if (!isLambdaUploadResponse(parsed)) throw new Error("unexpected response");
          onProgress(100);
          resolve(parsed);
        } catch {
          reject(new Error("Lambda returned an invalid or unexpected JSON response."));
        }
        return;
      }
      try {
        const parsed = JSON.parse(body) as { error?: string };
        reject(new Error(parsed.error || `Lambda upload failed with status ${xhr.status}.`));
      } catch {
        reject(new Error(body || `Lambda upload failed with status ${xhr.status}.`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during Lambda upload."));
    xhr.send(item.file);
  });
}

export async function uploadSingleFile(file: File, onProgress: (progress: number) => void) {
  const rejection = validateLambdaFile(file);
  if (rejection) throw new Error(rejection);

  const item: UploadQueueItem = {
    id: crypto.randomUUID(),
    file: new File([file], sanitizeFileName(file.name), { type: file.type }),
    status: "queued",
    progress: 0,
  };
  const response = await uploadFileThroughLambda(item, onProgress);
  return { ...item, status: "success" as const, progress: 100, objectKey: response.upload.objectKey };
}
