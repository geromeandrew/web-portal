import {
  apiRequest,
  ApiClientError,
  getAccessTokenForRequest,
  renewAccessToken,
} from "./apiClient";
import { acquirePrepaidUpload } from "./prepaidUploadQueue";

export type Region = "eg" | "sg";
export type WorkspaceResetContext = { runId: string; eg: number; sg: number };
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
  required: { code: string; fileName: string; acceptedFileNames?: string[] }[];
  accepted?: Sources["required"];
  collectionOnly?: boolean;
  guidelines?: string[];
  missing: string[];
  valid: boolean;
  files: { id: string; source_code: string; original_name: string }[];
  upstream: { manifest_key: string } | null;
};
export function findPrepaidUploadSource(sources: Sources | null, name: string) {
  const code = prepaidSourceCodeFromName(name);
  return (sources?.accepted ?? sources?.required ?? []).find((source) =>
    source.code === code,
  );
}
export function matchesPrepaidSourceName(
  source: Sources["required"][number],
  name: string,
) {
  return prepaidSourceCodeFromName(name) === source.code;
}
function prepaidSourceCodeFromName(name: string) {
  if (/[\\/\u0000-\u001f]/.test(name)) return undefined;
  const extension = name.match(/\.(xlsx|csv)$/i);
  if (!extension) return undefined;
  const stem = name.slice(0, extension.index).toLowerCase();
  const report = stem.match(/^(308|318)(?=[. _-])/);
  if (report) {
    const cycle = stem.match(/_(?:bc)?(0[1-9]|[12]\d|3[01])$/);
    if (
      extension[1].toLowerCase() !== "xlsx" ||
      !cycle ||
      /_[bi]$/.test(stem.slice(0, cycle.index))
    ) return undefined;
    return `${report[1]}_${cycle[1]}`;
  }

  const words = stem.split(/[^a-z0-9]+/).filter(Boolean);
  const title = words.join(" ");
  if (extension[1].toLowerCase() === "csv")
    return /\bmonthly recharge\b/.test(title) ? "monthly_recharge" : undefined;

  const eg = words.includes("eg");
  const sg = words.includes("sg");
  const region = eg === sg ? undefined : eg ? "eg" : "sg";
  const reportTypes = [
    [/\bke24\b/, "ke24"],
    [/\bcall ?card\b/, "callcard"],
    [/\bload ?up\b/, "load_up"],
    [/\bload ?api\b/, "load_api"],
  ] as const;
  const matches = reportTypes.filter(([pattern]) => pattern.test(title));
  if (matches.length !== 1) return undefined;
  const type = matches[0][1];
  return type === "ke24" ? type : region ? `${type}_${region}` : undefined;
}
export type Output = {
  revisionId: string;
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
};
export type Report = {
  run_id: string | null;
  snapshot_id: string;
  period: string | null;
  uploaded_at: string;
  uploaded_by: string;
  journals?: { region: Region; filename: string }[] | null;
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
  const release = await acquirePrepaidUpload(signal);
  try {
    return await sendSource(runId, code, file, signal, onProgress, workspace);
  } finally {
    release();
  }
}

async function sendSource(
  runId: string,
  code: string,
  file: File,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
  workspace: boolean,
) {
  const uploadId = workspace ? crypto.randomUUID() : undefined;
  let token = await getAccessTokenForRequest();
  let renewed = false,
    retries = 0;
  while (true) {
    if (signal.aborted)
      throw new DOMException("Upload cancelled", "AbortError");
    let response: { status: number; body: unknown };
    try {
      response = await new Promise<{ status: number; body: unknown }>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const abort = () => xhr.abort();
          const finish = () => signal.removeEventListener("abort", abort);
          xhr.open(
            "POST",
            `/api/workflows/prepaid/${workspace ? "workspace" : `runs/${runId}`}/sources/${encodeURIComponent(code)}`,
          );
          xhr.withCredentials = true;
          xhr.timeout = 300000;
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
            reject(new TypeError("Upload connection interrupted."));
          };
          xhr.ontimeout = () => {
            finish();
            reject(new TypeError("Upload timed out."));
          };
          xhr.onabort = () => {
            finish();
            reject(new DOMException("Upload cancelled", "AbortError"));
          };
          signal.addEventListener("abort", abort, { once: true });
          const form = new FormData();
          form.append("file", file);
          if (uploadId) form.append("uploadId", uploadId);
          if (signal.aborted) {
            finish();
            reject(new DOMException("Upload cancelled", "AbortError"));
            return;
          }
          xhr.send(form);
        },
      );
    } catch (error) {
      if (signal.aborted || (error as Error).name === "AbortError")
        throw new DOMException("Upload cancelled", "AbortError");
      if (!(error instanceof TypeError) || !workspace) throw error;
      // A lost response is not proof of failure. Reconcile this exact immutable
      // upload ID, never merely a matching filename from an older upload.
      try {
        const state = await prepaid<{ sources: Sources }>("/workspace");
        if (
          state.sources.files.some(
            (f) => f.id === uploadId && f.source_code === code,
          )
        ) {
          onProgress(100);
          return { id: uploadId! };
        }
      } catch {
        /* Retry the same ID safely; the server verifies bytes/ownership. */
      }
      if (retries++ >= 2)
        throw new Error(
          "Upload could not be confirmed after reconnecting. Refresh the workspace before retrying.",
        );
      await uploadDelay(1000 * retries, signal);
      continue;
    }
    if (response.status === 401 && !renewed && token) {
      renewed = true;
      token = await renewAccessToken();
      continue;
    }
    if (
      response.status === 503 &&
      (response.body as any)?.error?.code === "PREPAID_UPLOAD_BUSY" &&
      retries++ < 2
    ) {
      await uploadDelay(1000 * retries, signal);
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
    if (uploadId && (response.body as any)?.id !== uploadId)
      throw new ApiClientError(
        502,
        "UPLOAD_RECEIPT_INVALID",
        "The upload response did not confirm this file. Refresh the workspace.",
      );
    onProgress(100);
    return {
      id: uploadId ?? ((response.body as any)?.id as string | undefined),
    };
  }
}

function uploadDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function ungroupPrepaidAmount(value: string) {
  const text = value.trim();
  return /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)
    ? text.replaceAll(",", "")
    : text;
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

export type PrepaidImportStage = "extracting" | "refreshing-reference" | "importing-layouts";

export type PrepaidBatchStatus = {
  id: string;
  canReview: boolean;
  amaxeeReportAvailable?: boolean;
  status: "queued" | "running" | "review" | "failed" | "closed";
  phase: "import" | Region | "cleanup" | "release";
  deliveryEnabled: boolean;
  executions: Partial<Record<"import" | Region, { status: string; startedAt?: string; importStage?: PrepaidImportStage; journal?: { filename: string } }>>;
  layouts: Partial<Record<Region, { label: string; gross: string | null; frozen?: boolean | null }[]>>;
  error: string | null;
};
