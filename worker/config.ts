const FALLBACK_ALLOWED_MIME_TYPES = [
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
];

export type WorkerEnv = {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  S3_BUCKET_NAME: string;
  S3_KEY_PREFIX?: string;
  MAX_FILE_SIZE_BYTES?: string;
  PRESIGN_TTL_SECONDS?: string;
  ALLOWED_MIME_TYPES?: string;
  ALLOWED_ORIGINS?: string;
};

export function getAllowedMimeTypes(env: WorkerEnv) {
  const source = env.ALLOWED_MIME_TYPES?.trim();
  if (!source) return FALLBACK_ALLOWED_MIME_TYPES;
  return source.split(",").map((value) => value.trim()).filter(Boolean);
}

export function getAllowedOrigins(env: WorkerEnv) {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getMaxFileSizeBytes(env: WorkerEnv) {
  return Number(env.MAX_FILE_SIZE_BYTES ?? "26214400");
}

export function getPresignTtlSeconds(env: WorkerEnv) {
  return Math.min(900, Number(env.PRESIGN_TTL_SECONDS ?? "300"));
}
