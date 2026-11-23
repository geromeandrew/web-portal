import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { type Region } from "../../../lib/prepaidApi";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

type Option = { label: string; region: Region; variant?: "mt" | "bb" };
const allocationOptions: Option[] = [
  { label: "EG MT Allocation", region: "eg", variant: "mt" },
  { label: "EG BB Allocation", region: "eg", variant: "bb" },
  { label: "SG MT Allocation", region: "sg", variant: "mt" },
  { label: "SG BB Allocation", region: "sg", variant: "bb" },
];
const journalOptions: Option[] = [
  { label: "EG JV", region: "eg" },
  { label: "SG JV", region: "sg" },
];

export function PrepaidReviewNavigation({ workspace }: {
  workspace: Pick<PrepaidWorkspaceController, "tab" | "switchTab" | "region" | "variant" | "busy">;
}) {
  const { tab, switchTab, region, variant, busy } = workspace;
  const [open, setOpen] = useState<"allocation" | "jv" | null>(null);
  const menuId = useId();
  const dropdown = (kind: "allocation" | "jv", options: Option[]) => {
    const label = kind === "allocation" ? "Allocation" : "JV";
    const isOpen = !busy && open === kind;
    return (
      <div
        className={tab === kind ? "pp-tab-dropdown active" : "pp-tab-dropdown"}
        onMouseEnter={() => { if (!busy) setOpen(kind); }}
        onMouseLeave={() => setOpen((current) => current === kind ? null : current)}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(null);
            event.currentTarget.querySelector<HTMLButtonElement>(".pp-tab-trigger")?.focus();
          }
        }}
      >
        <button type="button" className="pp-tab-trigger" disabled={busy} aria-expanded={isOpen}
          aria-controls={menuId + "-" + kind} onClick={() => setOpen(isOpen ? null : kind)}>
          {label}<ChevronDown size={14} aria-hidden="true" />
        </button>
        <select id={kind + "-tab"} className="sr-only" aria-hidden="true" tabIndex={-1} disabled={busy}
          value={tab === kind ? (kind === "allocation" ? region + "-" + variant : region) : ""}
          onChange={(event) => {
            const [side, selectedVariant] = event.target.value.split("-");
            switchTab(kind, side as Region, selectedVariant as "mt" | "bb" | undefined);
          }}>
          <option value="" disabled>{label}</option>
          {options.map((option) => <option key={option.label} value={option.region + (option.variant ? "-" + option.variant : "")}>{option.label}</option>)}
        </select>
        {isOpen && <div id={menuId + "-" + kind} className="pp-tab-menu">
          {options.map((option) => <button type="button" key={option.label}
            onClick={() => { switchTab(kind, option.region, option.variant); setOpen(null); }}>
            {option.label}
          </button>)}
        </div>}
      </div>
    );
  };
  return (
    <nav className="pp-tabs" aria-label="Review sections">
      <button type="button" className={tab === "eg-layout" ? "active" : ""} disabled={busy}
        onClick={() => { setOpen(null); switchTab("eg-layout", "eg"); }}>EG Layout</button>
      <button type="button" className={tab === "sg-layout" ? "active" : ""} disabled={busy}
        onClick={() => { setOpen(null); switchTab("sg-layout", "sg"); }}>SG Layout</button>
      {dropdown("allocation", allocationOptions)}
      {dropdown("jv", journalOptions)}
      <button type="button" className={tab === "reports" ? "active" : ""} disabled={busy}
        aria-current={tab === "reports" ? "page" : undefined}
        onClick={() => { setOpen(null); switchTab("reports"); }}>Reports</button>
    </nav>
  );
}
