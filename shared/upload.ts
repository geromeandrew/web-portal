export type UploadCandidate = {
  id?: string;
  name: string;
  size: number;
  type: string;
};

export type RejectedUpload = {
  name: string;
  reason: string;
};

export type PresignedUpload = {
  id: string;
  objectKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
};

export type PresignUploadRequest = {
  files: UploadCandidate[];
};

export type PresignUploadResponse = {
  uploads: PresignedUpload[];
  rejected?: RejectedUpload[];
};

export type LambdaUploadResult = {
  id: string;
  bucket: string;
  objectKey: string;
  size: number;
  contentType: string;
  etag?: string;
  uploadedAt: string;
};

export type LambdaUploadResponse = {
  upload: LambdaUploadResult;
};
