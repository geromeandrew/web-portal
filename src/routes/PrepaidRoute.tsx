import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Check,
  CheckCheck,
  ChevronDown,
  Eye,
  History,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { ApiClientError, downloadApiFile } from "../lib/apiClient";
import {
  formatMoney,
  moneyFields,
  post,
  prepaid,
  uploadSource,
  type Layout,
  type Output,
  type Region,
  type Report,
  type Run,
  type Sources,
} from "../lib/prepaidApi";
import illustration from "../assets/workspace-background-illustration.png";
import guidelinesIcon from "../assets/file-guidelines-icon.svg";
import uploadIcon from "../assets/upload-files-icon.svg";
import paperIcon from "../assets/paper.svg";
import sheetsIcon from "../assets/sheets-icon.svg";
import "./prepaid.css";

type Tab = "eg-layout" | "sg-layout" | "allocation" | "jv";
type Transfer = {
  code: string;
  file: File;
  percent: number;
  status: "uploading" | "failed";
  error?: string;
  controller: AbortController;
};
type Modal = "reset" | "reset-success" | "history" | "breakdown" | null;
const headings = [
  "REVENUE BEFORE RECLASS",
  "GP EG MT GROSS",
  "HY EG MT GROSS",
  "GP EG BB GROSS",
  "TOTAL GROSS",
  "GP EG MT NET",
  "HY EG MT NET",
  "GP EG BB NET",
  "TOTAL NET",
];
const allocationFields = [
  "type",
  "gross",
  "tax_rate",
  "amount",
  "vat_oct",
  "total_gross",
  "difference",
];
const allocationHeaders = [
  "TYPE",
  "GROSS",
  "TAX RATE (%)",
  "AMOUNT",
  "VAT/OCT",
  "TOTAL GROSS",
  "DIFFERENCE",
];
const dateTime = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
const dateOnly = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button,input,select")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const elements = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href]",
          ) ?? [],
        );
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    const appRoot = document.getElementById("root");
    const wasInert = appRoot?.hasAttribute("inert");
    appRoot?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      if (!wasInert) appRoot?.removeAttribute("inert");
      previous?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="pp-overlay">
      <div
        ref={ref}
        className={`pp-dialog ${wide ? "pp-dialog-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          className="pp-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
function OutputTable({
  rows,
  fields,
  headers,
}: {
  rows: Record<string, unknown>[];
  fields: string[];
  headers: string[];
}) {
  return (
    <div className="pp-table-scroll">
      <table className="pp-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {fields.map((field, j) => (
                <td key={field} className={j ? "pp-number" : ""}>
                  {[
                    "gross",
                    "amount",
                    "vat_oct",
                    "total_gross",
                    "difference",
                    "amount2",
                  ].includes(field)
                    ? formatMoney(row[field], 2)
                    : row[field] === null || row[field] === undefined
                      ? ""
                      : String(row[field])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="pp-empty-data">No data available for this revision.</p>
      )}
    </div>
  );
}

export default function PrepaidRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const tab: Tab =
    params.section === "sg-layout"
      ? "sg-layout"
      : params.section === "allocation"
        ? "allocation"
        : params.section === "jv"
          ? "jv"
          : "eg-layout";
  const region: Region =
    tab === "sg-layout"
      ? "sg"
      : tab === "eg-layout"
        ? "eg"
        : params.region === "sg"
          ? "sg"
          : "eg";
  const variant = params.variant === "bb" ? "bb" : "mt";
  const [stage, setStage] = useState<1 | 2>(
    params.section === "file-upload" ? 1 : 2,
  );
  const [run, setRun] = useState<Run | null>(null);
  const [session, setSession] = useState<{
    id: string;
    version: number;
    status: string;
    run_id: string | null;
  } | null>(null);
  const [sources, setSources] = useState<Sources | null>(null),
    [layouts, setLayouts] = useState<Partial<Record<Region, Layout>>>({});
  const [transfers, setTransfers] = useState<Transfer[]>([]),
    [output, setOutput] = useState<Output | null>(null),
    [summary, setSummary] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [editing, setEditing] = useState(false),
    [changes, setChanges] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<Modal>(null),
    [historyDate, setHistoryDate] = useState(""),
    [reports, setReports] = useState<Report[]>([]),
    [historyOffset, setHistoryOffset] = useState(0),
    [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const input = useRef<HTMLInputElement>(null),
    generation = useRef(0),
    mounted = useRef(true),
    activeTransfers = useRef<Transfer[]>([]);
  const layout = layouts[region],
    dirty = Object.keys(changes).length > 0,
    uploading = transfers.some((t) => t.status === "uploading");
  const close = useCallback(() => setModal(null), []);
  const notify = (text: string) => setToast(text);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    activeTransfers.current = transfers;
  }, [transfers]);
  useEffect(
    () => () => {
      mounted.current = false;
      activeTransfers.current.forEach((t) => t.controller.abort());
    },
    [],
  );
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty || uploading) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const click = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (
        (dirty || uploading) &&
        anchor?.href &&
        anchor.href !== location.href &&
        !window.confirm(
          "Leave this workspace? Unsaved edits and ongoing uploads may be lost.",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, uploading]);
  const refresh = useCallback(async (id: string) => {
    const token = ++generation.current;
    const [next, files, eg, sg] = await Promise.all([
      prepaid<Run>(`/runs/${id}`),
      prepaid<Sources>(`/runs/${id}/sources`),
      prepaid<Layout>(`/runs/${id}/layouts/eg`),
      prepaid<Layout>(`/runs/${id}/layouts/sg`),
    ]);
    if (token === generation.current && mounted.current) {
      setRun(next);
      setSources(files);
      setLayouts({ eg, sg });
    }
    return { next, eg, sg };
  }, []);
  const workspaceGeneration = useRef(0);
  const refreshWorkspace = useCallback(async () => {
    const token = ++workspaceGeneration.current;
    const state = await prepaid<{
      session: typeof session;
      run: Run | null;
      sources: Sources;
      error: string | null;
    }>("/workspace");
    if (!mounted.current || token !== workspaceGeneration.current) return;
    setSession(state.session);
    setError(state.error ?? "");
    if (state.run) {
      const loaded = await refresh(state.run.id);
      if (!mounted.current || token !== workspaceGeneration.current) return;
      setStage(loaded.eg.imported && loaded.sg.imported ? 2 : 1);
    } else {
      setRun(null);
      setLayouts({});
      setStage(1);
    }
    setSources(state.sources);
  }, [refresh]);
  useEffect(() => {
    mounted.current = true;
    void refreshWorkspace()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [refreshWorkspace]);
  const perform = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiClientError && e.status === 409 && run) {
        setEditing(false);
        setChanges({});
        setModal(null);
        await refresh(run.id).catch(() => undefined);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const confirmLeave = () =>
    !dirty || window.confirm("Discard your unsaved layout edits?");
  const switchTab = (
    next: Tab,
    nextRegion: Region = region,
    nextVariant = variant,
  ) => {
    if (!confirmLeave()) return;
    setEditing(false);
    setChanges({});
    setPage(0);
    navigate(
      `/prepaid/${next}${next === "allocation" ? `/${nextRegion}/${nextVariant}` : next === "jv" ? `/${nextRegion}/mt` : ""}`,
    );
    setStage(2);
  };
  useEffect(() => {
    if (!run || stage !== 2 || (tab !== "allocation" && tab !== "jv")) return;
    let cancelled = false;
    setOutput(null);
    setSummary([]);
    const path = `/runs/${run.id}/layouts/${region}`;
    void Promise.all([
      prepaid<Output>(
        `${path}/${tab === "jv" ? "jv" : `allocations`}?limit=100&offset=${page * 100}${tab === "allocation" ? `&variant=${variant}` : ""}`,
      ),
      tab === "allocation"
        ? prepaid<{ rows: Record<string, unknown>[] }>(
            `${path}/allocation-summary?variant=${variant}`,
          )
        : Promise.resolve({ rows: [] }),
    ])
      .then(([result, totals]) => {
        if (!cancelled) {
          setOutput(result);
          setSummary(totals.rows);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [run?.id, layout?.version, tab, region, variant, page, stage]);
  const pending = session?.status === "pending";
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      void refreshWorkspace().catch((e) => setError((e as Error).message));
    }, 4000);
    return () => clearInterval(timer);
  }, [pending, refreshWorkspace]);
  useEffect(() => {
    if (modal !== "history") return;
    let cancelled = false;
    void prepaid<{ rows: Report[]; hasMore: boolean }>(
      `/report-history?limit=25&offset=${historyOffset}${historyDate ? `&date=${historyDate}` : ""}`,
    )
      .then((data) => {
        if (!cancelled) {
          setReports(data.rows);
          setHasMore(data.hasMore);
        }
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [modal, historyDate, historyOffset]);
  const startUpload = async (file: File) => {
    if (busy || loading || pending) {
      setError("Wait for source preparation before uploading.");
      return;
    }
    const expected = sources?.required.find(
      (s) => s.fileName.toLowerCase() === file.name.toLowerCase(),
    );
    if (!expected) {
      setError(
        `Unrecognized filename: ${file.name}. Use the exact names in File Guidelines.`,
      );
      return;
    }
    if (
      activeTransfers.current.some(
        (t) => t.code === expected.code && t.status === "uploading",
      )
    )
      return;
    const transfer: Transfer = {
      code: expected.code,
      file,
      percent: 0,
      status: "uploading",
      controller: new AbortController(),
    };
    activeTransfers.current = [
      ...activeTransfers.current.filter((t) => t.code !== transfer.code),
      transfer,
    ];
    setTransfers(activeTransfers.current);
    try {
      await uploadSource(
        "",
        transfer.code,
        file,
        transfer.controller.signal,
        (percent) =>
          setTransfers((old) =>
            old.map((t) =>
              t.controller === transfer.controller ? { ...t, percent } : t,
            ),
          ),
        true,
      );
      await refreshWorkspace();
      setTransfers((old) =>
        old.filter((t) => t.controller !== transfer.controller),
      );
    } catch (e) {
      await refreshWorkspace().catch(() => undefined);
      if ((e as Error).name === "AbortError")
        setTransfers((old) =>
          old.filter((t) => t.controller !== transfer.controller),
        );
      else
        setTransfers((old) =>
          old.map((t) =>
            t.controller === transfer.controller
              ? { ...t, status: "failed", error: (e as Error).message }
              : t,
          ),
        );
    }
  };
  const beginEdit = () =>
    void perform(async () => {
      if (!run || !layout?.imported) return;
      if (layout.frozen) {
        await post("/runs/" + run.id + "/layouts/" + region + "/edit", {
          version: layout.version,
        });
        await refresh(run.id);
      }
      setEditing(true);
      setChanges({});
    });
  const saveChanges = () =>
    void perform(async () => {
      if (!run || !layout) return;
      const cells = Object.entries(changes).map(([key, value]) => {
        const [number, field] = key.split(":");
        if (value && !/^-?\d{1,28}(?:\.\d{1,10})?$/.test(value))
          throw new Error(
            "Enter a decimal amount without commas (up to 28 integer and 10 fractional digits).",
          );
        return { layoutNumber: Number(number), field, value: value || null };
      });
      if (cells.length)
        await prepaid("/runs/" + run.id + "/layouts/" + region, {
          method: "PATCH",
          body: JSON.stringify({ version: layout.version, changes: cells }),
        });
      await refresh(run.id);
      setChanges({});
      setEditing(false);
      notify("Edits saved");
    });
  const freeze = () =>
    perform(async () => {
      if (!run || !layout) return;
      await post(`/runs/${run.id}/layouts/${region}/freeze`, {
        version: layout.version,
      });
      await refresh(run.id);
      notify(
        `Your ${region.toUpperCase()} reclassifications have been saved and locked.\nThe data is now staged and waiting for manual SAP execution.`,
      );
    });
  const reset = () =>
    perform(async () => {
      await post("/workspace/reset", {
        ...(run && layouts.eg && layouts.sg
          ? { runId: run.id, eg: layouts.eg.version, sg: layouts.sg.version }
          : {}),
        ...(session
          ? { sessionId: session.id, sessionVersion: session.version }
          : {}),
      });
      await refreshWorkspace();
      setEditing(false);
      setChanges({});
      setTransfers([]);
      setStage(1);
      navigate("/prepaid/file-upload");
      setModal("reset-success");
    });
  const download = (path: string, name: string) =>
    perform(async () => {
      await downloadApiFile("/workflows/prepaid" + path, name);
    });
  return (
    <section className="pp-workspace" aria-label="Prepaid Re-Class workspace">
      <img className="pp-illustration" src={illustration} alt="" />
      <header className="pp-heading">
        <h1>Prepaid Re-Class</h1>
        <div className="pp-subtitle">
          <p>
            Ad-hoc workflow for importing, reviewing, and applying prepaid
            revenue reclassifications
          </p>
          <button
            className="pp-link"
            onClick={() => {
              setHistoryOffset(0);
              setModal("history");
            }}
          >
            <History size={14} />
            History
          </button>
        </div>
      </header>
      <div className="pp-workflow">
        <ol className="pp-stepper" aria-label="Workflow stages">
          {([1, 2] as const).map((step) => (
            <li key={step}>
              <button
                className={`pp-step ${stage === step ? "active" : stage > step ? "complete" : ""}`}
                disabled={
                  step === 2 &&
                  !(layouts.eg?.imported && layouts.sg?.imported) &&
                  !(session?.status === "failed" && sources?.valid)
                }
                onClick={() => {
                  if (step === 2 && session?.status === "failed") {
                    void perform(async () => {
                      await post("/workspace/prepare");
                      await refreshWorkspace();
                    });
                    return;
                  }
                  if (confirmLeave()) {
                    setStage(step);
                    setEditing(false);
                    setChanges({});
                    navigate(
                      step === 1
                        ? "/prepaid/file-upload"
                        : "/prepaid/eg-layout",
                    );
                  }
                }}
              >
                {stage > step ? <Check size={20} /> : step}
              </button>
              <span className={stage === step ? "pp-current" : ""}>
                {step === 1 ? "Upload file" : "Edit & validate"}
              </span>
            </li>
          ))}
        </ol>
        <button
          className="pp-link pp-reset"
          disabled={(!run && !session) || busy || uploading || pending}
          onClick={() => setModal("reset")}
        >
          <RefreshCw size={15} />
          Reset
        </button>
      </div>
      <div className="pp-workflow-spacing" aria-hidden="true" />
      {error && (
        <div className="pp-error" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {stage === 1 ? (
        <div className="pp-upload-grid">
          <div className="pp-upload-card">
            <div className="pp-guidelines">
              <h2>
                <img src={guidelinesIcon} alt="" />
                File Guidelines
              </h2>
              <p>All files must follow the correct file name convention:</p>
              <ul>
                {sources?.required.map((s) => (
                  <li key={s.code}>{s.fileName}</li>
                ))}
              </ul>
              {!sources && <p>Loading source file guidelines…</p>}
            </div>
            <input
              ref={input}
              type="file"
              multiple
              accept=".xlsx,.csv,.txt"
              hidden
              onChange={(e) => {
                Array.from(e.target.files ?? []).forEach(
                  (f) => void startUpload(f),
                );
                e.target.value = "";
              }}
            />
            <button
              className="pp-dropzone"
              disabled={busy || loading || pending || !sources}
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                Array.from(e.dataTransfer.files).forEach(
                  (f) => void startUpload(f),
                );
              }}
            >
              <img src={uploadIcon} alt="" />
              <strong>Drop files here</strong>
              <span>or click to browse your computer</span>
            </button>
          </div>
          <div className="pp-upload-list">
            {!sources?.files.length && !transfers.length ? (
              <div className="pp-upload-empty">
                <img src={paperIcon} alt="" />
                <p>Uploaded files will appear here</p>
              </div>
            ) : (
              <>
                {sources?.files
                  .filter(
                    (f) => !transfers.some((t) => t.code === f.source_code),
                  )
                  .map((f) => (
                    <div className="pp-file" key={f.id}>
                      <img src={sheetsIcon} alt="" />
                      <span>{f.original_name}</span>
                      <span className="pp-upload-complete">
                        <Check size={15} />
                        Upload complete
                      </span>
                      <button
                        className="pp-icon"
                        disabled={busy || uploading || pending}
                        aria-label={`Remove ${f.original_name}`}
                        onClick={() =>
                          void perform(async () => {
                            await prepaid(
                              `/workspace/sources/${f.source_code}`,
                              { method: "DELETE" },
                            );
                            await refreshWorkspace();
                          })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                {transfers.map((t) => (
                  <div className="pp-file" key={t.code}>
                    <img src={sheetsIcon} alt="" />
                    <span>
                      {t.file.name}
                      {t.error && (
                        <small className="pp-failed">{t.error}</small>
                      )}
                    </span>
                    {t.status === "uploading" ? (
                      <>
                        <progress
                          max={100}
                          value={t.percent}
                          aria-label={`${t.file.name} upload progress`}
                        />
                        <span className="pp-percent">{t.percent}%</span>
                        <button
                          className="pp-link"
                          onClick={() => t.controller.abort()}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="pp-link"
                        onClick={() => void startUpload(t.file)}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <nav className="pp-tabs" aria-label="Review sections">
            <button
              className={tab === "eg-layout" ? "active" : ""}
              onClick={() => switchTab("eg-layout", "eg")}
            >
              EG Layout
            </button>
            <button
              className={tab === "sg-layout" ? "active" : ""}
              onClick={() => switchTab("sg-layout", "sg")}
            >
              SG Layout
            </button>
            <div className={tab === "allocation" ? "active" : ""}>
              <label className="sr-only" htmlFor="allocation-tab">
                Allocation view
              </label>
              <select
                id="allocation-tab"
                value={tab === "allocation" ? `${region}-${variant}` : ""}
                onChange={(e) => {
                  const [r, v] = e.target.value.split("-");
                  switchTab("allocation", r as Region, v as "mt" | "bb");
                }}
              >
                <option value="" disabled>
                  Allocation
                </option>
                <option value="eg-mt">EG MT Allocation</option>
                <option value="eg-bb">EG BB Allocation</option>
                <option value="sg-mt">SG MT Allocation</option>
                <option value="sg-bb">SG BB Allocation</option>
              </select>
              <ChevronDown size={14} />
            </div>
            <div className={tab === "jv" ? "active" : ""}>
              <label className="sr-only" htmlFor="jv-tab">
                JV view
              </label>
              <select
                id="jv-tab"
                value={tab === "jv" ? region : ""}
                onChange={(e) => switchTab("jv", e.target.value as Region)}
              >
                <option value="" disabled>
                  JV
                </option>
                <option value="eg">EG JV</option>
                <option value="sg">SG JV</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </nav>
          <div className="pp-review">
            <div className="pp-panel-heading">
              <h2>
                {region.toUpperCase()}{" "}
                {tab === "allocation"
                  ? `${variant.toUpperCase()} Allocation`
                  : tab === "jv"
                    ? "JV"
                    : "Layout Review"}
              </h2>
              {layout?.frozen_at && tab.endsWith("layout") && (
                <span className="pp-locked">
                  Data last saved and locked: {dateTime(layout.frozen_at)}
                </span>
              )}
              <div className="pp-actions">
                {tab.endsWith("layout") ? (
                  <>
                    <button
                      className="pp-outline"
                      disabled={busy || !layout?.imported}
                      onClick={() => (editing ? saveChanges() : beginEdit())}
                    >
                      {editing ? <Save size={16} /> : <Pencil size={16} />}
                      {editing ? "Save" : "Edit"}
                    </button>
                    <button
                      className="pp-primary"
                      disabled={busy || editing || dirty || !layout?.canFreeze}
                      onClick={freeze}
                    >
                      <CheckCheck size={16} />
                      Freeze
                    </button>
                  </>
                ) : tab === "allocation" ? (
                  <button
                    className="pp-outline"
                    disabled={!output}
                    onClick={() => setModal("breakdown")}
                  >
                    <Eye size={17} />
                    View breakdown
                  </button>
                ) : null}
              </div>
            </div>
            {tab.endsWith("layout") ? (
              <>
                <div className="pp-table-scroll">
                  <table
                    className={`pp-table pp-layout-table${editing ? " pp-layout-editing" : ""}`}
                  >
                    <thead>
                      <tr>
                        {headings.map((h, i) => (
                          <th key={h}>
                            {region === "sg" ? h.replaceAll("EG", "SG") : h}
                            {i === 0 && null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {layout?.rows
                        .filter(
                          (row) => row.layout_number !== 0 || row.label.trim(),
                        )
                        .map((row) => (
                          <tr key={row.layout_number}>
                            <td>{row.label}</td>
                            {moneyFields.map((field, i) => {
                              const editable =
                                row.editable &&
                                i < 3 &&
                                (row.editable_fields?.includes(field) ?? true);
                              const key = `${row.layout_number}:${field}`;
                              return (
                                <td className="pp-number" key={field}>
                                  {editing ? (
                                    <input
                                      aria-label={`${row.label} ${field}`}
                                      inputMode="decimal"
                                      disabled={!editable || busy}
                                      value={changes[key] ?? row[field] ?? ""}
                                      onChange={(e) =>
                                        setChanges((old) => {
                                          const next = { ...old };
                                          if (
                                            e.target.value ===
                                            (row[field] ?? "")
                                          )
                                            delete next[key];
                                          else next[key] = e.target.value;
                                          return next;
                                        })
                                      }
                                    />
                                  ) : (
                                    formatMoney(row[field], 2)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!layout?.rows.length && (
                    <p className="pp-empty-data">
                      Import processed sources to review the layout.
                    </p>
                  )}
                </div>
                {layout?.imported && !layout.validation?.valid && (
                  <div className="pp-validation" role="status">
                    <strong>
                      {layout.validation
                        ? "Validation needs attention"
                        : "Validation required"}
                    </strong>
                    <ul>
                      {(layout.validation?.findings ?? []).map((finding, i) => (
                        <li key={i}>
                          {typeof finding === "string"
                            ? finding
                            : JSON.stringify(finding)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : tab === "allocation" ? (
              <OutputTable
                rows={summary}
                fields={allocationFields}
                headers={allocationHeaders}
              />
            ) : (
              <>
                <OutputTable
                  rows={
                    output?.rows.map((row) => ({
                      posting_key: row.posting_key,
                      amount: row.amount,
                      quantity: row.quantity,
                      ...(row.fields as Record<string, unknown>),
                    })) ?? []
                  }
                  fields={[
                    "posting_key",
                    "amount",
                    "quantity",
                    ...Object.keys((output?.rows[0]?.fields ?? {}) as object),
                  ]}
                  headers={[
                    "POSTING KEY",
                    "AMOUNT",
                    "QUANTITY",
                    ...Object.keys(
                      (output?.rows[0]?.fields ?? {}) as object,
                    ).map((k) => k.replaceAll("_", " ").toUpperCase()),
                  ]}
                />
                <div className="pp-pagination">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {page + 1}</span>
                  <button
                    disabled={!output || (page + 1) * 100 >= output.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {toast && (
        <div className="pp-toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
        </div>
      )}
      {modal && (
        <Dialog
          key={modal}
          title={
            modal === "history"
              ? "Prepaid Re-Class History"
              : modal === "breakdown"
                ? "Allocation breakdown"
                : "Reset workspace"
          }
          onClose={close}
          wide={modal === "breakdown"}
        >
          {error && (
            <div className="pp-error" role="alert">
              {error}
            </div>
          )}
          {modal === "reset" ? (
            <div className="pp-reset-dialog">
              <div className="pp-question">?</div>
              <h2>Are you sure you want to reset the workspace?</h2>
              <p>
                Resetting the workspace will remove all your progress.
                <br />
                All saved reports can be viewed in History.
              </p>
              <div className="pp-actions">
                <button className="pp-outline" disabled={busy} onClick={close}>
                  No, go back
                </button>
                <button className="pp-primary" disabled={busy} onClick={reset}>
                  Yes, reset
                </button>
              </div>
            </div>
          ) : modal === "reset-success" ? (
            <div className="pp-reset-dialog">
              <div className="pp-success-icon">
                <Check size={54} />
              </div>
              <h2>Workspace reset</h2>
              <p>To start with re-classification, upload your source files</p>
              <button className="pp-primary" onClick={close}>
                Okay, got it
              </button>
            </div>
          ) : modal === "history" ? (
            <div className="pp-history">
              <h2>Prepaid Re-Class History</h2>
              <label className="pp-filter">
                Filter{" "}
                <input
                  aria-label="Filter report upload date"
                  type="date"
                  value={historyDate}
                  onChange={(e) => {
                    setHistoryDate(e.target.value);
                    setHistoryOffset(0);
                  }}
                />
              </label>
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>DATE OF UPLOAD</th>
                    <th>UPLOADED BY</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.snapshot_id}>
                      <td>{dateOnly(report.uploaded_at)}</td>
                      <td>{report.uploaded_by}</td>
                      <td>
                        <button
                          className="pp-link"
                          disabled={busy}
                          onClick={() =>
                            download(
                              "/runs/" +
                                report.run_id +
                                "/reports/" +
                                report.snapshot_id +
                                ".zip",
                              "prepaid-" + report.period + "-reports.zip",
                            )
                          }
                        >
                          Download reports
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!reports.length && (
                <p className="pp-empty-data">
                  No saved report snapshots for this date.
                </p>
              )}
              {(historyOffset > 0 || hasMore) && (
                <div className="pp-pagination">
                  <button
                    disabled={historyOffset === 0}
                    onClick={() => setHistoryOffset((p) => p - 25)}
                  >
                    Previous
                  </button>
                  <button
                    disabled={!hasMore}
                    onClick={() => setHistoryOffset((p) => p + 25)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="pp-breakdown">
              <h2>
                {region.toUpperCase()} {variant.toUpperCase()} Allocation
                breakdown
              </h2>
              <OutputTable
                rows={output?.rows ?? []}
                fields={[
                  "profit_center",
                  "cost_element",
                  "revenue_type",
                  "tax_rate",
                  "amount",
                  "denominator",
                  "allocation",
                  "gross",
                  "posting_key",
                  "amount2",
                ]}
                headers={[
                  "PROFIT CENTER",
                  "COST ELEMENT",
                  "REVENUE TYPE",
                  "TAX RATE",
                  "AMOUNT",
                  "DENOMINATOR",
                  "ALLOCATION",
                  "GROSS",
                  "POSTING KEY",
                  "FINAL AMOUNT",
                ]}
              />
              <div className="pp-pagination">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>Page {page + 1}</span>
                <button
                  disabled={!output || (page + 1) * 100 >= output.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </section>
  );
}
