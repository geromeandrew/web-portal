import {
  apiRequest,
  ApiClientError,
  getAccessTokenForRequest,
  renewAccessToken,
} from "./apiClient";

export type Region = "eg" | "sg";
export const moneyFields = [
  "gp_mt_gross",
  "hy_mt_gross",
  "gp_bb_gross",
  "total_gross",
  "gp_mt_net",
  "hy_mt_net",
  "gp_bb_net",
  "total_net",
] as const;
export type MoneyField = (typeof moneyFields)[number];
export type LayoutRow = {
  layout_number: number;
  label: string;
  editable: boolean;
  editable_fields?: MoneyField[];
} & Record<MoneyField, string | null>;
export type Layout = {
  id: string;
  version: number;
  status: string;
  imported: boolean;
  frozen: boolean;
  frozen_at: string | null;
  canFreeze: boolean;
  rows: LayoutRow[];
  validation: { valid: boolean; findings: unknown[] } | null;
};
export type Run = {
  id: string;
  period: string;
  snapshots: { id: string; status: string }[];
  jobs: { id: string; kind: string; status: string; error: unknown }[];
  deliveries: {
    id: string;
    revision_id: string;
    region: Region;
    status: string;
  }[];
};
export type Sources = {
  required: { code: string; fileName: string }[];
  missing: string[];
  valid: boolean;
  files: { id: string; source_code: string; original_name: string }[];
  upstream: { manifest_key: string } | null;
};
export type Output = {
  revisionId: string;
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
};
export type Report = {
  run_id: string;
  snapshot_id: string;
  period: string;
  uploaded_at: string;
  uploaded_by: string;
  revisions: {
    id: string;
    region: Region;
    revision: number;
    exports: { id: string; kind: string }[];
  }[];
};
export const prepaid = <T>(path: string, options?: RequestInit) =>
  apiRequest<T>(`/workflows/prepaid${path}`, options);
export const post = <T>(path: string, body: unknown = {}) =>
  prepaid<T>(path, { method: "POST", body: JSON.stringify(body) });

/** Progress is transport progress only; success requires an acknowledged response. */
export async function uploadSource(
  runId: string,
  code: string,
  file: File,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
  workspace = false,
) {
  let token = await getAccessTokenForRequest();
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal.aborted)
      throw new DOMException("Upload cancelled", "AbortError");
    const response = await new Promise<{ status: number; body: unknown }>(
      (resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const abort = () => xhr.abort();
        const finish = () => signal.removeEventListener("abort", abort);
        xhr.open(
          "POST",
          `/api/workflows/prepaid/${workspace ? "workspace" : `runs/${runId}`}/sources/${encodeURIComponent(code)}`,
        );
        xhr.withCredentials = true;
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        };
        xhr.onload = () => {
          finish();
          let body: unknown;
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            body = null;
          }
          resolve({ status: xhr.status, body });
        };
        xhr.onerror = () => {
          finish();
          reject(
            new Error(
              "Upload connection failed. Refresh to check whether it completed.",
            ),
          );
        };
        xhr.onabort = () => {
          finish();
          reject(new DOMException("Upload cancelled", "AbortError"));
        };
        signal.addEventListener("abort", abort, { once: true });
        const form = new FormData();
        form.append("file", file);
        xhr.send(form);
      },
    );
    if (response.status === 401 && attempt === 0 && token) {
      token = await renewAccessToken();
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      const error = response.body as {
        error?: { code?: string; message?: string };
      } | null;
      throw new ApiClientError(
        response.status,
        error?.error?.code ?? "UPLOAD_FAILED",
        error?.error?.message ?? "Upload failed.",
      );
    }
    onProgress(100);
    return;
  }
}

/** Format decimal strings without converting financial amounts to floating point. */
export function formatMoney(value: unknown, places?: number) {
  if (value === null || value === undefined || value === "") return "";
  let text = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
  if (places !== undefined) {
    const negative = text.startsWith("-");
    const [whole, decimal = ""] = text.replace(/^-/, "").split(".");
    const digits = decimal.padEnd(places + 1, "0");
    let scaled = BigInt(whole + digits.slice(0, places));
    if (digits[places] >= "5") scaled++;
    const rounded = scaled.toString().padStart(places + 1, "0");
    text =
      (negative && scaled !== 0n ? "-" : "") +
      (places
        ? rounded.slice(0, -places) + "." + rounded.slice(-places)
        : rounded);
  }
  const [integer, fraction] = text.split(".");
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction !== undefined ? "." + fraction : "")
  );
}
