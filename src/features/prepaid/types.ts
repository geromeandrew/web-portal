export type Tab = "eg-layout" | "sg-layout" | "allocation" | "jv" | "reports";
export type Transfer = {
  code: string;
  file: File;
  percent: number;
  status: "uploading" | "failed";
  error?: string;
  controller: AbortController;
};
export type Modal =
  "reset" | "reset-success" | "remove" | "history" | "breakdown" | null;
export type PrepaidUploadSession = {
  id: string;
  version: number;
  status: string;
  run_id: string | null;
};
