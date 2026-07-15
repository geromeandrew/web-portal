import type { PresignUploadResponse } from "../../shared/upload";

export type QueueStatus =
  | "queued"
  | "requesting"
  | "ready"
  | "uploading"
  | "success"
  | "error"
  | "rejected";

export type UploadQueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  objectKey?: string;
  uploadUrl?: string;
  headers?: Record<string, string>;
  expiresAt?: string;
  message?: string;
  transport?: "lambda" | "direct";
};

export function toQueueItems(files: File[]) {
  return files.map<UploadQueueItem>((file) => ({
    id: crypto.randomUUID(),
    file,
    status: "queued",
    progress: 0,
  }));
}

export function applyPresignResponse(
  items: UploadQueueItem[],
  response: PresignUploadResponse,
) {
  const uploadsByName = new Map(response.uploads.map((upload) => [upload.id, upload]));
  const rejectedByName = new Map(
    (response.rejected ?? []).map((rejection) => [rejection.name, rejection.reason]),
  );

  return items.map((item) => {
    const directMatch = uploadsByName.get(item.id);
    if (directMatch) {
      return {
        ...item,
        status: "ready" as const,
        objectKey: directMatch.objectKey,
        uploadUrl: directMatch.uploadUrl,
        headers: directMatch.headers,
        expiresAt: directMatch.expiresAt,
      };
    }

    const rejectedMessage = rejectedByName.get(item.file.name);
    if (rejectedMessage) {
      return {
        ...item,
        status: "rejected" as const,
        message: rejectedMessage,
      };
    }

    return item;
  });
}

export function updateQueueItem(
  items: UploadQueueItem[],
  id: string,
  patch: Partial<UploadQueueItem>,
) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
