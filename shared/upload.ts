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
