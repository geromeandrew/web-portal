import { ArrowDownUp, Search } from "lucide-react";
import { useMemo, useState } from "react";

type DemoTableProps = { headers: string[]; rows: string[][]; ariaLabel: string };

export default function DemoTable({ headers, rows, ariaLabel }: DemoTableProps) {
  const [query, setQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const filtered = useMemo(() => {
    const result = rows.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase()));
    if (sortColumn === null) return result;
    return [...result].sort((left, right) => left[sortColumn].localeCompare(right[sortColumn], undefined, { numeric: true }));
  }, [query, rows, sortColumn]);
  return <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
    <div className="flex flex-col gap-3 border-b border-[#E5E5EA] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[13px] text-[#8E8E93]">{filtered.length} of {rows.length} records</p><label className="relative"><span className="sr-only">Search {ariaLabel}</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="h-9 w-full rounded-[10px] border-0 bg-[#F2F2F7] pl-9 pr-3 text-[13px] text-[#1C1C1E] outline-none placeholder:text-[#8E8E93] focus:ring-2 focus:ring-[#007AFF]/30 sm:w-56" /></label></div>
    <div className="max-h-[560px] overflow-auto"><table className="min-w-full text-left"><thead className="sticky top-0 z-10 bg-[#F8F8FA]"><tr>{headers.map((header, index) => <th key={header} className="border-b border-[#E5E5EA] px-4 py-3 text-[11px] font-semibold text-[#636366]"><button onClick={() => setSortColumn(sortColumn === index ? null : index)} className="focus-ring inline-flex items-center gap-1 whitespace-nowrap text-left">{header}<ArrowDownUp className="h-3 w-3 text-[#AEAEB2]" /></button></th>)}</tr></thead><tbody>{filtered.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-b border-[#F2F2F7] last:border-0 hover:bg-[#F8F8FA]">{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className={`whitespace-nowrap px-4 py-3 text-[13px] ${cell === "Total" ? "font-semibold text-[#1C1C1E]" : "text-[#3A3A3C]"}`}>{cell || "-"}</td>)}</tr>)}{filtered.length === 0 ? <tr><td colSpan={headers.length} className="px-4 py-14 text-center text-[13px] text-[#8E8E93]">No matching records.</td></tr> : null}</tbody></table></div>
  </section>;
}
