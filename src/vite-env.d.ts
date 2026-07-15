/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UPLOAD_SIGNER_URL?: string;
  readonly VITE_MAX_FILE_SIZE_BYTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
