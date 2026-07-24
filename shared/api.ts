export type UserDto = {
  id: string;
  email: string;
  isBootstrapAdmin: boolean;
  mustChangePassword: boolean;
  createdAt: string;
};

export type UploadDto = {
  id: string;
  workflow: "prepaid" | "memo" | "aprm";
  slot?: string;
  originalName: string;
  objectKey: string;
  size: number;
  contentType: string;
  uploadedAt: string;
};

export type UploadPolicyDto = {
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
};

export type ApiError = {
  error: { code: string; message: string; fields?: Record<string, string> };
};
