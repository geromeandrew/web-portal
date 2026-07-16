import { Check, ChevronDown, Download, FileSpreadsheet, FolderOpen, LoaderCircle, Pencil, Play, RefreshCcw, Snowflake, Unlock, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DemoTable from "../components/DemoTable";
import PageHeader from "../components/PageHeader";
import { allocationHeaders, allocationRows, egLayoutRows, jvHeaders, jvRows, layoutHeaders, prepaidSourceFiles, sgLayoutRows } from "../lib/demoData";
import { uploadSingleFile, validateWorkflowFile } from "../lib/uploadClient";
import { useUploadMode } from "../lib/uploadMode";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type SlotStatus = "empty" | "uploading" | "success" | "error";
type Slot = { expected: string; status: SlotStatus; name?: string; size?: string; created?: string; progress?: number; message?: string };

const prepaidLinks = [
  { id: "file-upload", label: "File Upload", to: "/prepaid/file-upload" },
  { id: "eg-layout", label: "EG Layout", to: "/prepaid/eg-layout" },
  { id: "sg-layout", label: "SG Layout", to: "/prepaid/sg-layout" },
  { id: "allocation", label: "Allocation" },
  { id: "jv", label: "JV" },
  { id: "reports", label: "Reports", to: "/prepaid/reports" },
];

const allocationOptions = [
  ["eg", "mt", "EG MT Allocation"], ["eg", "bb", "EG BB Allocation"], ["sg", "mt", "SG MT Allocation"], ["sg", "bb", "SG BB Allocation"],
] as const;
const jvOptions = [["eg", "EG"], ["sg", "SG"]] as const;

function reportDownload() {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["Revenue before reclass,Total gross,Total net\nGP-EG-MT,-34738196.06,-31016246.48"], { type: "text/csv" }));
  link.download = "prepaid-reclass-report.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function PrepaidRoute() {
  const { section = "file-upload", region, variant } = useParams();
  const { uploadMode } = useUploadMode();
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [jvOpen, setJvOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [frozen, setFrozen] = useState<Record<string, boolean>>({ "eg-layout": false, "sg-layout": true });
  const [slots, setSlots] = useState<Slot[]>(() => prepaidSourceFiles.map((expected) => ({ expected, status: "empty" })));

  const title = useMemo(() => {
    if (section === "eg-layout") return "Prepaid Systems 01 EG Layout";
    if (section === "sg-layout") return "Prepaid Systems 51 SG Layout";
    if (section === "allocation") return region === "eg" && variant === "mt" ? "Prepaid Systems 02A EG MT Allocation" : `Prepaid Systems ${region?.toUpperCase() ?? ""} ${variant?.toUpperCase() ?? ""} Allocation`;
    if (section === "jv") return `Prepaid Systems 03 ${region?.toUpperCase() ?? "EG"} JV`;
    if (section === "reports") return "Prepaid Systems Report";
    return "Prepaid Reclass - File Upload";
  }, [region, section, variant]);

  const selectSlotFile = async (expected: string, file?: File) => {
    if (!file) return;
    const workflowError = validateWorkflowFile(file, [XLSX]);
    if (workflowError) {
      setSlots((current) => current.map((slot) => slot.expected === expected ? { ...slot, status: "error", message: workflowError } : slot));
      return;
    }
    setSlots((current) => current.map((slot) => slot.expected === expected ? { ...slot, status: "uploading", name: file.name, progress: 3, message: undefined } : slot));
    try {
      await uploadSingleFile(file, uploadMode, (progress) => setSlots((current) => current.map((slot) => slot.expected === expected ? { ...slot, progress } : slot)));
      setSlots((current) => current.map((slot) => slot.expected === expected ? { ...slot, status: "success", progress: 100, created: new Date().toLocaleString(), size: `${(file.size / 1_000_000).toFixed(2)}` } : slot));
    } catch (error) {
      setSlots((current) => current.map((slot) => slot.expected === expected ? { ...slot, status: "error", progress: 0, message: error instanceof Error ? error.message : "Upload failed." } : slot));
    }
  };

  const currentRows = section === "eg-layout" ? egLayoutRows : sgLayoutRows;
  const isReferenceAllocation = section === "allocation" && region === "eg" && variant === "mt";
  const isReferenceJv = section === "jv" && region === "eg";
  const allUploaded = slots.every((slot) => slot.status === "success");

  return <div className="space-y-5">
    <PageHeader eyebrow="Prepaid systems" title={title} description="File upload, import and manual data inputs.">
      <nav className="portal-tabs" aria-label="Prepaid navigation">
        {prepaidLinks.map((item) => item.to ? <Link key={item.id} to={item.to} className={`portal-tab ${section === item.id ? "portal-tab-active" : ""}`}>{item.label}</Link> : <div key={item.id} className="relative shrink-0"><button onClick={() => { if (item.id === "allocation") { setAllocationOpen((open) => !open); setJvOpen(false); } else { setJvOpen((open) => !open); setAllocationOpen(false); } }} className={`portal-tab flex items-center gap-1 ${section === item.id ? "portal-tab-active" : ""}`}>{item.label}<ChevronDown className="h-3.5 w-3.5" /></button>{item.id === "allocation" && allocationOpen ? <div className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-panel">{allocationOptions.map(([optionRegion, optionVariant, label]) => <Link key={label} to={`/prepaid/allocation/${optionRegion}/${optionVariant}`} onClick={() => setAllocationOpen(false)} className="block px-4 py-2.5 text-[13px] text-slate-700 transition hover:bg-teal/5 hover:text-teal">{label}</Link>)}</div> : null}{item.id === "jv" && jvOpen ? <div className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-panel">{jvOptions.map(([optionRegion, label]) => <Link key={label} to={`/prepaid/jv/${optionRegion}/view`} onClick={() => setJvOpen(false)} className="block px-4 py-2.5 text-[13px] text-slate-700 transition hover:bg-teal/5 hover:text-teal">{label}</Link>)}</div> : null}</div>)}
      </nav>
    </PageHeader>

    {notice ? <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800"><Check className="h-4 w-4" />{notice}</div> : null}

    {section === "file-upload" ? <section>
      <button disabled={!allUploaded} onClick={() => setNotice("Prepaid source files are ready for processing.")} className="focus-ring portal-button-primary mb-3"><Play className="h-4 w-4" />Start Processing</button>
      {!allUploaded ? <p className="mb-3 text-[12px] text-slate-500">Upload all seven required source files to enable processing.</p> : null}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]"><table className="min-w-full text-left text-[14px]"><thead className="bg-[#F8F8FA]"><tr className="border-b border-[#E5E5EA]"><th className="px-4 py-3">File Name</th><th className="px-4 py-3">Date Created</th><th className="px-4 py-3">File Size(MB)</th><th className="px-4 py-3">Upload File</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{slots.map((slot) => <tr key={slot.expected} className="border-b border-[#F2F2F7] transition-colors hover:bg-teal/[0.025] last:border-b-0"><td className={`px-4 py-4 font-medium ${slot.status === "success" ? "text-emerald-700" : "text-red-600"}`}><div className="flex items-center gap-2">{slot.expected}{slot.status === "uploading" ? <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-600"><LoaderCircle className="h-3 w-3 animate-spin" />{slot.progress}%</span> : null}</div>{slot.status === "uploading" ? <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal to-sky-500 transition-all duration-300" style={{ width: `${slot.progress ?? 0}%` }} /></div> : null}</td><td className="px-4 py-4 text-slate-700">{slot.created ?? ""}</td><td className="px-4 py-4 text-slate-700">{slot.size ?? ""}</td><td className="px-4 py-4"><label className="inline-flex cursor-pointer items-center gap-2 rounded-[9px] border border-[#E5E5EA] bg-[#F2F2F7] px-3 py-1.5 text-[13px] transition hover:bg-[#EAF2FF] hover:text-[#007AFF]"><Upload className="h-3.5 w-3.5" />Choose File<input className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { void selectSlotFile(slot.expected, event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{slot.message ? <p className="mt-1 max-w-xs text-[11px] text-red-600">{slot.message}</p> : null}</td><td className="px-4 py-4">{slot.status === "success" ? <button onClick={() => setSlots((current) => current.map((item) => item.expected === slot.expected ? { expected: item.expected, status: "empty" } : item))} className="text-[13px] text-[#007AFF] hover:underline">Remove</button> : ""}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-[13px] text-slate-700">Showing 1 to 7 of 7 entries</p>
    </section> : null}

    {(section === "eg-layout" || section === "sg-layout") ? <><div className="flex flex-wrap gap-2"><button onClick={() => setNotice("Layout restored to its last imported state.")} className="focus-ring portal-button-secondary"><RefreshCcw className="h-4 w-4" />Reset</button>{section === "eg-layout" ? <button onClick={() => setNotice("Demo import completed. Layout values are refreshed.")} className="focus-ring portal-button-primary"><FileSpreadsheet className="h-4 w-4" />Import</button> : null}<button onClick={() => setFrozen((current) => ({ ...current, [section]: !current[section] }))} className="focus-ring portal-button-primary">{frozen[section] ? <Unlock className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}{frozen[section] ? "Un-Freeze" : "Freeze"}</button></div><DemoTable ariaLabel="Prepaid layout" headers={layoutHeaders} rows={currentRows} actions={(row) => row[0] && !row[0].startsWith("**") && !row[0].startsWith("GP-") && !row[0].startsWith("HY-") ? <button className="focus-ring grid h-9 w-9 place-items-center rounded-[10px] bg-teal/10 text-teal transition hover:bg-teal hover:text-white" aria-label={`Edit ${row[0]}`}><Pencil className="h-3.5 w-3.5" /></button> : null} /></> : null}

    {section === "allocation" ? <><div className="flex items-center gap-2"><button onClick={() => setNotice("Allocation validation completed with no blocking issues.")} className="focus-ring portal-button-primary"><Check className="h-4 w-4" />Validation</button></div><DemoTable ariaLabel="Allocation rows" caption={region === "eg" && variant === "mt" ? "02A EG MT Allocation" : `${region?.toUpperCase()} ${variant?.toUpperCase()} Allocation`} headers={allocationHeaders} rows={isReferenceAllocation ? allocationRows : []} /></> : null}

    {section === "jv" ? <DemoTable ariaLabel="Journal voucher rows" headers={jvHeaders} rows={isReferenceJv ? jvRows : []} /> : null}

    {section === "reports" ? <section className="portal-panel overflow-hidden"><div className="flex items-center justify-between border-b border-[#E5E5EA] px-4 py-3"><div className="flex items-center gap-2 text-[13px] text-slate-600"><strong>Show</strong><select className="h-8 rounded-[8px] border-0 bg-slate-100 px-2"><option>10</option></select><strong>entries</strong></div><label className="text-[13px] font-semibold text-slate-700">Search: <input className="portal-input ml-2 w-40" /></label></div><div className="border-b border-[#E5E5EA] px-4 py-3 text-[14px] font-bold text-slate-800">Report</div><button onClick={reportDownload} className="flex w-full items-center gap-3 px-4 py-5 text-left text-[14px] font-semibold text-teal transition hover:bg-teal/5"><span className="grid h-11 w-14 place-items-center rounded-xl bg-amber-50 text-[#ba8500]"><FolderOpen className="h-7 w-7 fill-current" /></span>Prepaid Report</button><div className="flex items-center justify-between border-t border-[#E5E5EA] px-4 py-3 text-[13px] text-slate-600"><span>Showing 1 to 1 of 1 entries</span><span>Previous <span className="mx-3 rounded-[8px] bg-slate-100 px-3 py-2">1</span> Next</span></div></section> : null}
  </div>;
}
