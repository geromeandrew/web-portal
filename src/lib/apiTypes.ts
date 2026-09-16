export type UserDto = {
  id: string;
  email: string;
  displayName: string | null;
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

export type ProcessingPipelineStage =
  "inbound" | "outbound" | "processed" | "error";

export type ProcessingPipelineFileDto = {
  id: string;
  expectedFileName: string;
  matchedFileName: string | null;
  legacyPackageName: string | null;
  jobName: string | null;
  availability: "present" | "missing";
  key: string | null;
  size: number | null;
  lastModified: string | null;
  stepFunction?: {
    stateMachineName: string;
    batchCycle: string | null;
    executionInput: Record<string, unknown>;
  } | null;
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
  runId: string;
  targetMode: "adhoc" | "batch";
  stateMachineName: string;
  executionInput: Record<string, unknown>;
  startedAt: string;
};

export type ProcessingPipelineRunStatusDto = {
  runId: string;
  targetMode: "adhoc" | "batch";
  stateMachineName: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  stepFunctionsConsoleUrl: string;
};

export type ProcessingPipelineCatalogDto = {
  pipelines: { label: string; code: string }[];
};

export type ProcessingPipelineExecutionDetailsDto = {
  pipelineCode: string;
  expectedFileName: string;
  sourceFile: { key: string; s3Uri: string; exists: boolean };
  execution: {
    input: Record<string, unknown>;
    stateMachine: { status: string; type: string; stateMachineName?: string };
  };
  canExecute: boolean;
  blockingReasons: string[];
};

export type ProcessingPipelineBatchExecutionDetailsDto = {
  pipelineCode: string;
  batchCycle: string;
  targetMode: "batch" | "partial";
  sourceFiles: {
    expectedFileName: string;
    key: string;
    s3Uri: string;
    displayOrder: number;
  }[];
  missingFiles: {
    expectedFileName: string;
    key: string;
    s3Uri: string;
    displayOrder: number;
    reason: string;
  }[];
  execution: {
    stateMachine?: { status: string; type: string; stateMachineName?: string };
    workflows?: {
      expectedFileName: string;
      stateMachine: { status: string; type: string; stateMachineName?: string };
    }[];
  };
  canExecute: boolean;
  blockingReasons: string[];
};

export type ProcessingPipelineBatchRunDto = {
  targetMode: "batch" | "partial";
  batchCycle?: string;
  runId?: string;
  stateMachineName?: string;
  sourceFiles: { expectedFileName: string; key: string; s3Uri: string }[];
  missingFiles: {
    expectedFileName: string;
    key: string;
    s3Uri: string;
    reason: string;
  }[];
  startedRuns?: Array<{
    runId: string;
    expectedFileName: string;
    stateMachineName: string;
    startedAt: string;
  }>;
  failedFiles?: Array<{ expectedFileName: string; error: { message: string } }>;
  startedAt?: string;
};
