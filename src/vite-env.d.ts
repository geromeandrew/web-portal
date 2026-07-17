/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LAMBDA_UPLOAD_URL?: string;
  readonly VITE_LAMBDA_MAX_FILE_SIZE_BYTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
