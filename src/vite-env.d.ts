/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DIRECT_UPLOAD_URL?: string;
  readonly VITE_MAX_FILE_SIZE_BYTES?: string;
  readonly VITE_LAMBDA_UPLOAD_URL?: string;
  readonly VITE_LAMBDA_MAX_FILE_SIZE_BYTES?: string;
  readonly VITE_UPLOAD_TRANSPORT?: "direct" | "lambda";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
