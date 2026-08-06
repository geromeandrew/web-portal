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

export type ApiError = {
  error: { code: string; message: string; fields?: Record<string, string> };
};

export type ProcessingPipelineStage = "inbound" | "outbound" | "processed" | "error";

export type ProcessingPipelineFileDto = {
  id: string;
  stage: ProcessingPipelineStage;
  expectedFileName: string;
  matchedFileName: string | null;
  legacyPackageName: string | null;
  jobName: string | null;
  availability: "present" | "missing";
  key: string | null;
  size: number | null;
  lastModified: string | null;
  configuration?: {
    acquisitionMethod: "webUpload" | "sftpPull";
    remoteSftpSourceDirectory: string | null;
    sourceFilePullRenameRules: string | null;
    s3Destination: string;
    legacyPackageName: string | null;
    databaseSchemaDestination: string | null;
    tableDestinations: string[];
  };
};

export type ProcessingPipelineFileListDto = {
  configured: boolean;
  files: ProcessingPipelineFileDto[];
};

export type ProcessingPipelineRunDto = {
  jobRunId: string;
  jobName: string;
  startedAt: string;
};

export type ProcessingPipelineRunStatusDto = {
  jobRunId: string;
  jobName: string;
  status: string;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  glueConsoleUrl: string;
  cloudWatchLogsUrl: string;
};

export type ProcessingPipelineCatalogDto = {
  pipelines: { label: string; code: string }[];
  stages: { label: string; code: ProcessingPipelineStage }[];
};
