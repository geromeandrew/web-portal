import type {
  LambdaUploadResponse,
  PresignUploadRequest,
  PresignUploadResponse,
  UploadCandidate,
} from "../../shared/upload";
import { sanitizeFileName } from "./utils";
import { applyPresignResponse, type UploadQueueItem } from "./uploadState";

const DEFAULT_MAX_FILE_SIZE_BYTES = Number(import.meta.env.VITE_MAX_FILE_SIZE_BYTES ?? 26_214_400);
const DEFAULT_LAMBDA_MAX_FILE_SIZE_BYTES = Number(
  import.meta.env.VITE_LAMBDA_MAX_FILE_SIZE_BYTES ?? 4_500_000,
);
const DEFAULT_ALLOWED_TYPES = new Set([
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

  // Vite proxies this route in development, avoiding a browser CORS preflight.
  return import.meta.env.DEV && lambdaUploadUrl ? "/lambda-upload" : lambdaUploadUrl;
}

export function getDirectPresignUrl() {
  const directUploadUrl = import.meta.env.VITE_DIRECT_UPLOAD_URL?.replace(/\/$/, "");
  const baseUrl = directUploadUrl || getLambdaUploadBaseUrl();
  return baseUrl ? `${baseUrl}/presign` : "";
}

function isLambdaUploadResponse(value: unknown): value is LambdaUploadResponse {
  if (!value || typeof value !== "object") return false;
  const upload = (value as { upload?: unknown }).upload;
  if (!upload || typeof upload !== "object") return false;

  return typeof (upload as { objectKey?: unknown }).objectKey === "string";
}

export function validateLocalFiles(files: File[]) {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];

  for (const file of files) {
    if (file.size <= 0) {
      rejected.push({
        name: file.name,
        reason: "Empty files are not allowed.",
      });
      continue;
    }

    if (file.size > DEFAULT_MAX_FILE_SIZE_BYTES) {
      rejected.push({
        name: file.name,
        reason: `Exceeds ${Math.round(DEFAULT_MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB limit.`,
      });
      continue;
    }

    if (!DEFAULT_ALLOWED_TYPES.has(file.type)) {
      rejected.push({
        name: file.name,
        reason: "File type is not allowed for this portal.",
      });
      continue;
    }

    accepted.push(new File([file], sanitizeFileName(file.name), { type: file.type }));
  }

  return { accepted, rejected };
}

export function validateLambdaFile(file: File) {
  if (file.size > DEFAULT_LAMBDA_MAX_FILE_SIZE_BYTES) {
    return `Exceeds ${Math.round(DEFAULT_LAMBDA_MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB Lambda upload limit.`;
  }

  if (!DEFAULT_ALLOWED_TYPES.has(file.type)) {
    return "File type is not allowed for this portal.";
  }

  if (file.size <= 0) {
    return "Empty files are not allowed.";
  }

  return null;
}

export function validateWorkflowFile(file: File, allowedTypes?: readonly string[]) {
  const allowedTypeError = allowedTypes && !allowedTypes.includes(file.type)
    ? "This workflow accepts Excel (.xlsx) files only."
    : null;

  if (allowedTypeError) return allowedTypeError;
  return null;
}

export async function requestPresignedUploads(
  items: UploadQueueItem[],
): Promise<PresignUploadResponse> {
  const files: UploadCandidate[] = items.map((item) => ({
    id: item.id,
    name: item.file.name,
    size: item.file.size,
    type: item.file.type,
  }));

  const body: PresignUploadRequest = { files };
  const presignUrl = getDirectPresignUrl();
  if (!presignUrl) {
    throw new Error("VITE_LAMBDA_UPLOAD_URL is not configured for Direct S3 uploads.");
  }

  const response = await fetch(presignUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to request upload URLs.");
  }

  return (await response.json()) as PresignUploadResponse;
}

export async function uploadFileWithProgress(
  item: UploadQueueItem,
  onProgress: (progress: number) => void,
) {
  const uploadUrl = item.uploadUrl;
  if (!uploadUrl) {
    throw new Error("Upload URL missing.");
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);

    Object.entries(item.headers ?? {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    if (!item.headers?.["Content-Type"]) {
      xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error(`Upload failed with status ${xhr.status}.`));
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(item.file);
  });
}

export async function uploadFileThroughLambda(
  item: UploadQueueItem,
  onProgress: (progress: number) => void,
): Promise<LambdaUploadResponse> {
  const baseUrl = getLambdaUploadBaseUrl();
  if (!baseUrl) {
    throw new Error("VITE_LAMBDA_UPLOAD_URL is not configured.");
  }

  return new Promise<LambdaUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", baseUrl);
    xhr.responseType = "text";
    xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(item.file.name));
    xhr.setRequestHeader("X-File-Size", String(item.file.size));
    xhr.setRequestHeader("X-Upload-Id", item.id);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.max(1, Math.min(98, Math.round((event.loaded / event.total) * 98))));
    };

    xhr.onload = () => {
      const body = xhr.responseText;

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(body) as unknown;
          if (!isLambdaUploadResponse(parsed)) {
            reject(
              new Error(
                "Lambda returned an unexpected response. Confirm VITE_LAMBDA_UPLOAD_URL points to the web portal uploader Lambda.",
              ),
            );
            return;
          }

          onProgress(100);
          resolve(parsed);
        } catch {
          reject(new Error("Lambda returned an invalid JSON response."));
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

export async function uploadSingleFile(
  file: File,
  transport: "lambda" | "direct",
  onProgress: (progress: number) => void,
) {
  const id = crypto.randomUUID();
  const baseItem: UploadQueueItem = {
    id,
    file: new File([file], sanitizeFileName(file.name), { type: file.type }),
    status: "queued",
    progress: 0,
    transport,
  };

  if (transport === "lambda") {
    const rejection = validateLambdaFile(baseItem.file);
    if (rejection) throw new Error(rejection);
    const response = await uploadFileThroughLambda(baseItem, onProgress);
    return { ...baseItem, status: "success" as const, progress: 100, objectKey: response.upload.objectKey };
  }

  const { accepted, rejected } = validateLocalFiles([baseItem.file]);
  if (rejected.length || !accepted.length) throw new Error(rejected[0]?.reason ?? "File could not be uploaded.");
  const response = await requestPresignedUploads([baseItem]);
  const [ready] = applyPresignResponse([baseItem], response);
  if (ready.status === "rejected") throw new Error(ready.message ?? "File was rejected.");
  await uploadFileWithProgress(ready, onProgress);
  return { ...ready, status: "success" as const, progress: 100 };
}
