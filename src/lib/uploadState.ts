export type QueueStatus = "queued" | "uploading" | "success" | "error" | "rejected";

export type UploadQueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  objectKey?: string;
  message?: string;
};

export function updateQueueItem(
  items: UploadQueueItem[],
  id: string,
  patch: Partial<UploadQueueItem>,
) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
