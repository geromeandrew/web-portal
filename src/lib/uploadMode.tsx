import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type UploadMode = "lambda" | "direct";

type UploadModeContextValue = {
  uploadMode: UploadMode;
  setUploadMode: (mode: UploadMode) => void;
};

const UploadModeContext = createContext<UploadModeContextValue | null>(null);
const STORAGE_KEY = "dt-plus-upload-mode";

export function UploadModeProvider({ children }: { children: ReactNode }) {
  const [uploadMode, setUploadMode] = useState<UploadMode>(() => {
    return window.localStorage.getItem(STORAGE_KEY) === "direct" ? "direct" : "lambda";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, uploadMode);
  }, [uploadMode]);

  const value = useMemo(() => ({ uploadMode, setUploadMode }), [uploadMode]);
  return <UploadModeContext.Provider value={value}>{children}</UploadModeContext.Provider>;
}

export function useUploadMode() {
  const context = useContext(UploadModeContext);
  if (!context) throw new Error("useUploadMode must be used within UploadModeProvider.");
  return context;
}
