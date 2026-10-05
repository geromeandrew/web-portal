import {
  Check,
  CheckCircle2,
  Download,
  FileText,
  History,
  LoaderCircle,
  Pencil,
  RefreshCcw,
  Save,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import fileGuidelinesIcon from "../assets/file-guidelines-icon.svg";
import sheetsIcon from "../assets/sheets-icon.svg";
import uploadFilesIcon from "../assets/upload-files-icon.svg";
import workspaceBackgroundIllustration from "../assets/workspace-background-illustration.png";
import { apiRequest, downloadApiFile } from "../lib/apiClient";
import { allocationHeaders, jvHeaders, layoutHeaders } from "../lib/demoData";
import type { ProcessingPipelineCatalogDto, ProcessingPipelineFileListDto } from "../lib/apiTypes";
import { validateWorkflowFile } from "../lib/uploadClient";
import { resolveWorkspacePipelineCode } from "../lib/workspaces";

const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type Stage = 1 | 2 | 3;
type Slot = {
  expected: string;
  status: "empty" | "uploading" | "success" | "error";
  uploadId?: string;
  name?: string;
  progress?: number;
  message?: string;
};
type State = {
  egLayout: { rows: string[][] };
  sgLayout: { rows: string[][] };
  allocation: { rows: string[][] };
  jv: { rows: string[][] };
  sourceFiles: { expected: string[] };
  uploads: Array<{ id: string; slot?: string; originalName: string }>;
};
type Activity = {
  id: string;
  action: "uploaded" | "removed" | "cleared";
  fileName: string | null;
  slot: string | null;
  removedCount: number | null;
  occurredAt: string;
};

const ui = {
  page: "relative isolate -mx-5 -my-10 min-h-[calc(100vh-72px)] overflow-hidden bg-[#f2f7fe] px-5 py-11 sm:-mx-8 sm:-my-12 sm:px-8 sm:py-12 lg:-mx-0 lg:-my-14 lg:px-0 lg:py-8",
  content: "relative mx-auto w-full max-w-none",
  title:
    "font-elliot text-[26px] font-bold leading-8 tracking-[-0.025em] text-[#0e1522] 2xl:text-[30px] 2xl:leading-10",
  description:
    "mt-1 font-elliot text-[13px] leading-5 text-[#1c2431] 2xl:text-[15px] 2xl:leading-6",
  workflowGrid:
    "mt-12 grid items-start gap-2 xl:grid-cols-[412fr_806fr] 2xl:mt-14 2xl:gap-3",
  panel:
    "overflow-hidden rounded-[8px] bg-white shadow-[0_2px_8px_rgba(20,47,89,0.08)] ring-1 ring-[#e4eaf2]",
  uploadPanel: "min-h-[529px] p-5 2xl:min-h-[600px] 2xl:p-6",
  panelHeading: "font-elliot text-[11px] font-bold 2xl:text-[13px]",
  guidance:
    "mt-4 rounded-[5px] bg-[#f6f9fd] px-4 py-4 2xl:mt-5 2xl:px-5 2xl:py-5",
  dropZone:
    "focus-ring mt-4 flex min-h-[267px] w-full flex-col items-center justify-center rounded-[5px] border border-dashed px-6 text-center 2xl:mt-5 2xl:min-h-[323px]",
  activityHeader:
    "flex min-h-[37px] items-center bg-[#e8eef8] px-6 font-elliot text-[11px] font-bold 2xl:min-h-[46px] 2xl:px-7 2xl:text-[13px]",
  button:
    "focus-ring inline-flex items-center justify-center gap-2 rounded-[5px] bg-[#087dca] px-4 py-2.5 font-elliot text-[12px] font-semibold text-white transition hover:bg-[#066caf] disabled:cursor-not-allowed disabled:opacity-45 2xl:px-5 2xl:py-3 2xl:text-[14px]",
};
const stageFor = (section?: string): Stage =>
  section === "eg-layout" || section === "sg-layout"
    ? 2
    : section === "allocation" || section === "jv" || section === "reports"
      ? 3
      : 1;

function downloadCsv(
  headers: readonly string[],
  rows: readonly string[][],
  name: string,
) {
  const quote = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  const blob = new Blob(
    [[headers, ...rows].map((row) => row.map(quote).join(",")).join("\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Stepper({
  stage,
  setStage,
}: {
  stage: Stage;
  setStage(value: Stage): void;
}) {
  return (
    <ol
      className="mt-12 flex max-w-[330px] justify-between"
      aria-label="Prepaid workflow stages"
    >
      {(
        [
          [1, "Upload file"],
          [2, "Edit layout"],
          [3, "Validate entries"],
        ] as const
      ).map(([value, label], index) => (
        <li
          key={value}
          className="relative flex w-[96px] flex-col items-center text-center"
        >
          {index ? (
            <span className="absolute right-[calc(50%+18px)] top-[18px] h-px w-[60px] bg-[#1689df]" />
          ) : null}
          <button
            onClick={() => setStage(value)}
            className={`focus-ring relative z-10 grid h-9 w-9 place-items-center rounded-full border-2 font-elliot text-[14px] font-bold ${stage > value ? "border-[#087dca] bg-[#087dca] text-white" : stage === value ? "border-[#087dca] bg-white text-[#087dca] ring-2 ring-[#a8d6ff]" : "border-transparent bg-[#91b3cf] text-white"}`}
          >
            {stage > value ? <Check className="h-5 w-5" /> : value}
          </button>
          <span
            className={`mt-2 whitespace-nowrap font-elliot text-[11px] ${stage === value ? "font-bold" : ""}`}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function DataTable({
  headers,
  rows,
  label,
}: {
  headers: readonly string[];
  rows: readonly string[][];
  label: string;
}) {
  if (!rows.length)
    return (
      <div
        className={`${ui.panel} grid min-h-[310px] place-items-center p-8 text-center`}
      >
        <div>
          <FileText className="mx-auto h-8 w-8 text-[#8bb4d8]" />
          <p className="mt-3 font-elliot text-[13px] font-bold">
            No data available
          </p>
          <p className="mt-1 font-elliot text-[12px] text-[#64748b]">
            This {label} is not yet available for review.
          </p>
        </div>
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full whitespace-nowrap text-left font-elliot text-[11px]">
        <thead className="bg-[#e8eef8] text-[10px] font-bold uppercase text-[#4165a8]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-6 py-3">
                {header.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row[0]}-${index}`}
              className={index % 2 ? "bg-[#f1f5fd]" : "bg-white"}
            >
              {headers.map((header, cell) => (
                <td
                  key={header}
                  className={`px-6 py-3 ${cell ? "text-right tabular-nums" : "font-medium"}`}
                >
                  {row[cell] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrepaidRoute() {
  const { section, region, variant } = useParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const legacyReviewTab =
    section === "jv" && (region === "eg" || region === "sg")
      ? `${region}-jv`
      : section === "allocation" &&
          (region === "eg" || region === "sg") &&
          (variant === "mt" || variant === "bb")
        ? `${region}-${variant}`
        : "eg-mt";
  const [stage, setStage] = useState<Stage>(() => stageFor(section));
  const [layoutTab, setLayoutTab] = useState<"eg" | "sg">(
    section === "sg-layout" ? "sg" : "eg",
  );
  const [reviewTab, setReviewTab] = useState(legacyReviewTab);
  const [state, setState] = useState<State | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [pipelineCode, setPipelineCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [historyDate, setHistoryDate] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const load = async (code = pipelineCode) => {
    if (!code) return;
    const [next, pipelineFiles] = await Promise.all([
      apiRequest<State>("/workflows/prepaid/state"),
      apiRequest<ProcessingPipelineFileListDto>(`/processing-pipelines/${encodeURIComponent(code)}/files`),
    ]);
    setState(next);
    setSlots(
      next.sourceFiles.expected.map((expected) => {
        const upload = pipelineFiles.files.find((file) =>
          file.expectedFileName.toLocaleLowerCase() === expected.toLocaleLowerCase() && file.availability === "present",
        );
        return upload
          ? {
              expected,
              status: "success",
              uploadId: upload.id,
              name: upload.matchedFileName ?? upload.expectedFileName,
              progress: 100,
            }
          : { expected, status: "empty" };
      }),
    );
  };
  useEffect(() => {
    void apiRequest<ProcessingPipelineCatalogDto>("/processing-pipelines")
      .then((catalog) => {
        const code = resolveWorkspacePipelineCode("prepaid-re-class", catalog.pipelines);
        if (!code) throw new Error("The Prepaid Re-Class storage pipeline is not available.");
        setPipelineCode(code);
        return load(code);
      })
      .catch((error: Error) => setNotice(error.message));
  }, []);
  useEffect(() => {
    setStage(stageFor(section));
    if (section === "sg-layout") setLayoutTab("sg");
    setReviewTab(legacyReviewTab);
  }, [legacyReviewTab, section]);
  const allUploaded =
    slots.length > 0 && slots.every((slot) => slot.status === "success");
  const isJv = reviewTab.endsWith("jv");
  const rows =
    reviewTab === "eg-mt"
      ? (state?.allocation.rows ?? [])
      : reviewTab === "eg-jv"
        ? (state?.jv.rows ?? [])
        : [];
  const headers = isJv ? jvHeaders : allocationHeaders;
  const label =
    reviewTab === "eg-mt"
      ? "EG MT Allocation"
      : reviewTab === "eg-jv"
        ? "EG JV"
        : reviewTab.replaceAll("-", " ").toUpperCase();
  const historyDates = [
    ...new Set(activities.map((activity) => activity.occurredAt.slice(0, 10))),
  ];
  const visibleActivities = historyDate
    ? activities.filter((activity) =>
        activity.occurredAt.startsWith(historyDate),
      )
    : activities;
  const uploadFiles = async (files: FileList | File[]) => {
    const expected = new Map(
      slots.map((slot) => [slot.expected.toLocaleLowerCase(), slot.expected]),
    );
    const selected = new Map<string, File>();
    for (const file of Array.from(files)) {
      const slot = expected.get(file.name.toLocaleLowerCase());
      if (!slot) {
        setNotice(
          `${file.name} is not required by the current Prepaid file mapping.`,
        );
        return;
      }
      if (selected.has(slot)) {
        setNotice(`Duplicate file selected: ${file.name}.`);
        return;
      }
      const validation = validateWorkflowFile(file, [XLSX]);
      if (validation) {
        setNotice(validation);
        return;
      }
      selected.set(slot, file);
    }
    setNotice(null);
    for (const [expectedName, file] of selected) {
      setSlots((current) =>
        current.map((slot) =>
          slot.expected === expectedName
            ? {
                ...slot,
                status: "uploading",
                name: file.name,
                progress: 1,
                message: undefined,
              }
            : slot,
        ),
      );
      try {
        if (!pipelineCode) throw new Error("The Prepaid Re-Class storage pipeline is not available.");
        const body = new FormData();
        body.set("expectedFileName", expectedName);
        body.set(
          "replace",
          slots.some((slot) => slot.expected === expectedName && slot.status === "success")
            ? "true"
            : "false",
        );
        body.set("file", file);
        await apiRequest(
          `/processing-pipelines/${encodeURIComponent(pipelineCode)}/files`,
          { method: "POST", body },
        );
        setSlots((current) =>
          current.map((slot) =>
            slot.expected === expectedName
              ? {
                  ...slot,
                  status: "success",
                  progress: 100,
                }
              : slot,
          ),
        );
      } catch (error) {
        setSlots((current) =>
          current.map((slot) =>
            slot.expected === expectedName
              ? {
                  ...slot,
                  status: "error",
                  message:
                    error instanceof Error ? error.message : "Upload failed.",
                }
              : slot,
          ),
        );
      }
    }
    await load();
  };
  const importLayouts = async () => {
    setBusy(true);
    try {
      await apiRequest("/workflows/prepaid/process", { method: "POST" });
      await Promise.all([
        apiRequest("/workflows/prepaid/layouts/eg/import", { method: "POST" }),
        apiRequest("/workflows/prepaid/layouts/sg/import", { method: "POST" }),
      ]);
      await load();
      setStage(2);
      setLayoutTab("eg");
      setNotice("Files imported to EG and SG layouts.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };
  const openHistory = async () => {
    setHistoryOpen(true);
    try {
      setActivities(
        (
          await apiRequest<{ activities: Activity[] }>(
            "/workflows/prepaid/history",
          )
        ).activities,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to load history.",
      );
    }
  };
  const clearAll = async () => {
    setBusy(true);
    try {
      const result = await apiRequest<{ removedCount: number }>(
        "/workflows/prepaid/uploads",
        { method: "DELETE" },
      );
      await load();
      setNotice(
        `${result.removedCount} uploaded file${result.removedCount === 1 ? "" : "s"} cleared from Prepaid Re-Class storage.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to clear files.",
      );
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  };
  return (
    <div className={ui.page}>
      <img
        src={workspaceBackgroundIllustration}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 hidden w-[31rem] object-contain opacity-60 lg:block"
      />
      <section className={ui.content} aria-labelledby="prepaid-title">
        <h1 id="prepaid-title" className={ui.title}>
          Prepaid Re-Class
        </h1>
        <p className={ui.description}>
          Ad-hoc workflow for importing, reviewing, and applying prepaid revenue
          reclassifications.{" "}
          <button
            onClick={() => void openHistory()}
            className="focus-ring ml-3 inline-flex items-center gap-1 text-[#087dca] underline underline-offset-2"
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
        </p>
        <Stepper stage={stage} setStage={setStage} />
        <div className="mt-[-8px] flex justify-end">
          <button
            onClick={() => setConfirmClear(true)}
            disabled={!slots.some((slot) => slot.status === "success") || busy}
            className="focus-ring inline-flex items-center gap-2 font-elliot text-[12px] text-[#087dca] underline underline-offset-2 disabled:opacity-45"
          >
            <RefreshCcw className="h-4 w-4" />
            Clear all
          </button>
        </div>
        {notice ? (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-[5px] bg-[#e8f8ef] px-4 py-3 font-elliot text-[12px] text-[#16794d]"
          >
            <CheckCircle2 className="h-4 w-4" />
            {notice}
          </div>
        ) : null}
        {stage === 1 ? (
          <div className={ui.workflowGrid}>
            <section className={`${ui.panel} ${ui.uploadPanel}`}>
              <h2 className={ui.panelHeading}>FILE UPLOAD</h2>
              <div className={ui.guidance}>
                <div className="flex items-center gap-2 font-elliot text-[12px] font-bold 2xl:gap-3 2xl:text-[14px]">
                  <img
                    src={fileGuidelinesIcon}
                    alt=""
                    className="h-5 w-5 2xl:h-6 2xl:w-6"
                  />
                  File Guidelines
                </div>
                <p className="mt-3 font-elliot text-[11px] 2xl:mt-4 2xl:text-[13px]">
                  All files must follow the correct file name convention:
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 font-elliot text-[11px] 2xl:mt-2 2xl:space-y-1 2xl:pl-5 2xl:text-[13px]">
                  {slots.map((slot) => (
                    <li key={slot.expected}>{slot.expected}</li>
                  ))}
                </ul>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files) void uploadFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              <button
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void uploadFiles(event.dataTransfer.files);
                }}
                className={`${ui.dropZone} ${dragging ? "border-[#087dca] bg-[#eef8ff]" : "border-[#79baff] bg-[#f8fcff]"}`}
              >
                <img
                  src={uploadFilesIcon}
                  alt=""
                  className="h-10 w-auto 2xl:h-14"
                />
                <span className="mt-3 font-elliot text-[11px] font-bold text-[#087dca] 2xl:mt-4 2xl:text-[13px]">
                  Drop files here
                </span>
                <span className="font-elliot text-[11px] text-[#087dca] 2xl:text-[13px]">
                  or click to browse your computer
                </span>
              </button>
            </section>
            <section
              className="space-y-2 2xl:space-y-3"
              aria-label="Upload activity"
            >
              <div className={ui.activityHeader}>UPLOAD ACTIVITY</div>
              {slots.map((slot) => (
                <div
                  key={slot.expected}
                  className={`${ui.panel} grid min-h-[50px] grid-cols-[minmax(0,1fr)_150px_auto] items-center gap-4 px-5`}
                >
                  <div className="flex min-w-0 items-center gap-2 font-elliot text-[11px]">
                    <img src={sheetsIcon} alt="" className="h-4" />
                    <span className="truncate">
                      {slot.name ?? slot.expected}
                    </span>
                  </div>
                  {slot.status === "uploading" ? (
                    <div className="flex items-center gap-2">
                      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#edf0f3]">
                        <div
                          className="h-full rounded-full bg-[#1399eb]"
                          style={{ width: `${slot.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[#89919d]">
                        {slot.progress ?? 0}%
                      </span>
                    </div>
                  ) : (
                    <span
                      className={`font-elliot text-[11px] ${slot.status === "success" ? "text-[#17ad6b]" : slot.status === "error" ? "text-red-600" : "text-[#89919d]"}`}
                    >
                      {slot.status === "success"
                        ? "✓ Upload complete"
                        : slot.status === "error"
                          ? slot.message
                          : "Waiting"}
                    </span>
                  )}
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => void importLayouts()}
                  disabled={!allUploaded || busy}
                  className={ui.button}
                >
                  {busy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : null}
                  Import to EG &amp; SG
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {stage === 2 ? (
          <section className="mt-10">
            <div className="flex gap-1">
              <button
                onClick={() => setLayoutTab("eg")}
                className={`rounded-t-[9px] px-4 py-2 font-elliot text-[11px] ${layoutTab === "eg" ? "bg-white font-bold" : "bg-[#d6e1ed] text-[#6281a7]"}`}
              >
                EG Layout
              </button>
              <button
                onClick={() => setLayoutTab("sg")}
                className={`rounded-t-[9px] px-4 py-2 font-elliot text-[11px] ${layoutTab === "sg" ? "bg-white font-bold" : "bg-[#d6e1ed] text-[#6281a7]"}`}
              >
                SG Layout
              </button>
            </div>
            <div className={`${ui.panel} p-6`}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="font-elliot text-[14px] font-bold">
                  {layoutTab.toUpperCase()} Layout Review
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setNotice("Layout editing is not enabled yet.")
                    }
                    className="focus-ring inline-flex items-center gap-2 rounded-[5px] border border-[#087dca] px-4 py-2 font-elliot text-[12px] text-[#087dca]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit table
                  </button>
                  <button onClick={() => setStage(3)} className={ui.button}>
                    <Save className="h-3.5 w-3.5" />
                    Move to Allocation &amp; JV
                  </button>
                </div>
              </div>
              <DataTable
                headers={layoutHeaders}
                rows={
                  layoutTab === "eg"
                    ? (state?.egLayout.rows ?? [])
                    : (state?.sgLayout.rows ?? [])
                }
                label={`${layoutTab.toUpperCase()} layout`}
              />
            </div>
          </section>
        ) : null}
        {stage === 3 ? (
          <section className="mt-10">
            <div className="flex flex-wrap gap-0.5">
              {[
                ["eg-mt", "EG MT Allocation"],
                ["eg-bb", "EG BB Allocation"],
                ["sg-mt", "SG MT Allocation"],
                ["sg-bb", "SG BB Allocation"],
                ["eg-jv", "EG JV"],
                ["sg-jv", "SG JV"],
              ].map(([id, title]) => (
                <button
                  key={id}
                  onClick={() => setReviewTab(id)}
                  className={`rounded-t-[9px] px-4 py-2 font-elliot text-[11px] ${reviewTab === id ? "bg-white font-bold" : "bg-[#d6e1ed] text-[#6281a7]"}`}
                >
                  {title}
                </button>
              ))}
            </div>
            <div className={`${ui.panel} p-6`}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="font-elliot text-[14px] font-bold">{label}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      downloadCsv(
                        headers,
                        rows,
                        label.replaceAll(" ", "-").toLowerCase(),
                      )
                    }
                    disabled={!rows.length}
                    className="focus-ring inline-flex items-center gap-2 rounded-[5px] border border-[#087dca] px-4 py-2 font-elliot text-[12px] text-[#087dca] disabled:opacity-45"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                  {!isJv ? (
                    <button
                      onClick={() =>
                        void apiRequest(
                          "/workflows/prepaid/allocation/validate",
                          { method: "POST" },
                        )
                          .then(() =>
                            setNotice(
                              "Allocation validation completed with no blocking issues.",
                            ),
                          )
                          .catch((error: Error) => setNotice(error.message))
                      }
                      disabled={!rows.length}
                      className={ui.button}
                    >
                      <Check className="h-4 w-4" />
                      Validate
                    </button>
                  ) : null}
                </div>
              </div>
              <DataTable headers={headers} rows={rows} label={label} />
            </div>
          </section>
        ) : null}
      </section>
      {historyOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Prepaid Re-Class History"
          className="fixed inset-0 z-50 grid place-items-center bg-[#0e1522]/50 p-3 sm:p-8"
        >
          <section className="max-h-[92vh] w-full max-w-[630px] overflow-auto rounded-[5px] bg-white px-6 py-9 shadow-2xl sm:px-12 sm:py-10">
            <div className="flex items-start justify-between">
              <h2 className="font-elliot text-[25px] font-bold tracking-[-0.025em] text-[#0e1522]">
                Prepaid Re-Class History
              </h2>
              <button
                onClick={() => setHistoryOpen(false)}
                className="focus-ring -mr-1 -mt-2 p-1 text-[#171b24]"
                aria-label="Close history"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-7 flex items-center gap-3 font-elliot text-[10px] text-[#252d39]">
              Filter
              <select
                value={historyDate}
                onChange={(event) => setHistoryDate(event.target.value)}
                className="focus-ring h-[28px] min-w-[94px] rounded-[3px] border border-[#b8c1cf] bg-white px-2 font-elliot text-[10px] text-[#64748b]"
              >
                <option value="">Select date</option>
                {historyDates.map((date) => (
                  <option key={date} value={date}>
                    {new Date(`${date}T00:00:00`).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-7 overflow-x-auto">
              <table className="w-full min-w-[500px] font-elliot text-left text-[11px]">
                <thead className="bg-[#e8eef8] text-[10px] font-bold uppercase text-[#4165a8]">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">File</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleActivities.length ? (
                    visibleActivities.map((activity, index) => (
                      <tr
                        key={activity.id}
                        className={index % 2 ? "bg-[#eef4fb]" : "bg-white"}
                      >
                        <td className="px-6 py-3">
                          {new Date(activity.occurredAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {activity.fileName ?? "—"}
                        </td>
                        <td className="px-6 py-3">
                          {activity.action === "uploaded"
                            ? "Uploaded"
                            : `Cleared ${activity.removedCount ?? 0} file${activity.removedCount === 1 ? "" : "s"}`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-10 text-center text-[#64748b]"
                      >
                        No prepaid upload activity for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
      {confirmClear ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm clearing uploaded files"
          className="fixed inset-0 z-50 grid place-items-center bg-[#0e1522]/30 p-5"
        >
          <section className="w-full max-w-sm rounded-[8px] bg-white p-6 shadow-2xl">
            <h2 className="font-elliot text-[17px] font-bold">
              Clear uploaded files?
            </h2>
            <p className="mt-2 font-elliot text-[12px] leading-5 text-[#64748b]">
              This permanently deletes the current Prepaid Re-Class source files
              from the pipeline S3 folder.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmClear(false)}
                className="focus-ring rounded-[5px] px-4 py-2 font-elliot text-[12px]"
              >
                Cancel
              </button>
              <button onClick={() => void clearAll()} className={ui.button}>
                Clear all
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
