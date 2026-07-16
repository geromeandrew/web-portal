import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, Check, ChevronLeft, ChevronRight, Columns3, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type DemoTableProps = {
  headers: string[];
  rows: string[][];
  ariaLabel: string;
  caption?: string;
  actions?: (row: string[], index: number) => ReactNode;
  emptyMessage?: string;
  pageSize?: number;
};

type Density = "comfortable" | "compact";

function isNumeric(value: string) {
  return /^-?[\d,.]+$/.test(value.replace(/,/g, ""));
}

function columnWidth(header: string, index: number) {
  if (index === 0) return 230;
  if (header.length > 18) return 190;
  return 150;
}

export default function DemoTable({ headers, rows, ariaLabel, caption, actions, emptyMessage = "No data available in table", pageSize = 25 }: DemoTableProps) {
  const [query, setQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(pageSize);
  const [density, setDensity] = useState<Density>(headers.length > 8 ? "compact" : "comfortable");
  const [visibleColumns, setVisibleColumns] = useState<number[]>(() => headers.map((_, index) => index));
  const [columnsOpen, setColumnsOpen] = useState(false);

  const filtered = useMemo(() => {
    const result = rows.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase()));
    if (sortColumn === null) return result;
    return [...result].sort((left, right) => left[sortColumn].localeCompare(right[sortColumn], undefined, { numeric: true }));
  }, [query, rows, sortColumn]);
  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const visibleRows = filtered.slice(page * limit, (page + 1) * limit);
  const columns = visibleColumns.map((index) => ({ index, header: headers[index] })).filter((column) => column.header !== undefined);
  const tableWidth = (actions ? 76 : 0) + columns.reduce((total, column) => total + columnWidth(column.header, column.index), 0);
  const from = filtered.length ? page * limit + 1 : 0;
  const to = Math.min((page + 1) * limit, filtered.length);
  const rowPadding = density === "compact" ? "py-2.5" : "py-3.5";

  useEffect(() => setPage(0), [limit, query]);
  useEffect(() => setPage((current) => Math.min(current, pages - 1)), [pages]);
  useEffect(() => {
    setVisibleColumns(headers.map((_, index) => index));
    setDensity(headers.length > 8 ? "compact" : "comfortable");
  }, [headers]);

  const toggleColumn = (index: number) => setVisibleColumns((current) => current.includes(index) ? current.filter((candidate) => candidate !== index) : [...current, index].sort((left, right) => left - right));
  const resetColumns = () => setVisibleColumns(headers.map((_, index) => index));

  return <section className="overflow-visible rounded-2xl bg-white shadow-[0_18px_50px_rgba(27,46,110,0.08)] ring-1 ring-slate-200/70" aria-label={ariaLabel}>
    <div className="flex flex-col gap-3 rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-white via-sky-50/70 to-white px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-teal/10 text-teal"><SlidersHorizontal className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-slate-700">{filtered.length.toLocaleString()} records</p><p className="truncate text-[11px] text-slate-400">{caption ?? ariaLabel}</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-[10px] bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">Rows<select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="bg-transparent text-[12px] font-semibold text-slate-700 outline-none"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><button onClick={() => setDensity((current) => current === "compact" ? "comfortable" : "compact")} className="focus-ring rounded-[10px] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/80 transition hover:text-teal">{density === "compact" ? "Compact" : "Comfortable"}</button><div className="relative"><button onClick={() => setColumnsOpen((open) => !open)} className="focus-ring inline-flex items-center gap-1.5 rounded-[10px] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/80 transition hover:text-teal" aria-expanded={columnsOpen}><Columns3 className="h-3.5 w-3.5" />Columns <span className="text-slate-400">{columns.length}/{headers.length}</span></button><AnimatePresence>{columnsOpen ? <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-panel"><div className="flex items-center justify-between px-2 pb-2 pt-1"><span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Visible columns</span><button onClick={resetColumns} className="text-[11px] font-semibold text-teal hover:underline">Reset</button></div><div className="max-h-64 overflow-y-auto">{headers.map((header, index) => <label key={header} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-slate-700 hover:bg-teal/5"><input type="checkbox" checked={visibleColumns.includes(index)} onChange={() => toggleColumn(index)} className="sr-only" /><span className={`grid h-4 w-4 place-items-center rounded border ${visibleColumns.includes(index) ? "border-teal bg-teal text-white" : "border-slate-300 bg-white"}`}>{visibleColumns.includes(index) ? <Check className="h-3 w-3" /> : null}</span><span className="truncate">{header}</span></label>)}</div></motion.div> : null}</AnimatePresence></div><label className="relative"><span className="sr-only">Search {ariaLabel}</span><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" className="h-9 w-52 rounded-[10px] border-0 bg-white pl-8 pr-8 text-[12px] text-slate-800 shadow-sm ring-1 ring-slate-200/80 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-teal/25 sm:w-60" />{query ? <button onClick={() => setQuery("")} className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear table search"><X className="h-3.5 w-3.5" /></button> : null}</label></div>
    </div>
    <div className="relative max-h-[620px] overflow-auto rounded-b-2xl [scrollbar-color:#9ecfd0_transparent] [scrollbar-width:thin]"><table className="border-separate border-spacing-0 table-fixed text-left text-[13px]" style={{ minWidth: `${Math.max(760, tableWidth)}px`, width: `${tableWidth}px` }}><colgroup>{actions ? <col style={{ width: 76 }} /> : null}{columns.map((column) => <col key={column.index} style={{ width: columnWidth(column.header, column.index) }} />)}</colgroup>
      <thead className="sticky top-0 z-20 bg-[#F8FBFC]/95 backdrop-blur"><tr>{actions ? <th className="sticky left-0 z-40 border-b border-r border-slate-200 bg-[#F8FBFC] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Action</th> : null}{columns.map((column, displayIndex) => <th key={column.header} style={displayIndex === 0 ? { left: actions ? 76 : 0 } : undefined} className={`border-b border-r border-slate-200 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 ${displayIndex === 0 ? "sticky z-30 bg-[#F8FBFC] shadow-[8px_0_12px_-12px_rgba(15,23,42,.35)]" : ""}`}><button onClick={() => setSortColumn(sortColumn === column.index ? null : column.index)} className="focus-ring inline-flex w-full items-center gap-1.5 truncate rounded text-left transition hover:text-teal"><span className="truncate">{column.header}</span><ArrowDownUp className={`h-3 w-3 shrink-0 ${sortColumn === column.index ? "text-teal" : "text-slate-300"}`} /></button></th>)}</tr></thead>
      <tbody>{visibleRows.map((row, rowIndex) => <motion.tr key={`${row[0]}-${rowIndex}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(rowIndex * 0.014, 0.14) }} className="group border-b border-slate-100 odd:bg-slate-50/[0.32] last:border-b-0 hover:bg-teal/[0.045]">{actions ? <td className={`sticky left-0 z-10 border-r border-slate-200 bg-white px-4 ${rowPadding} transition-colors group-hover:bg-[#F7FFFE]`}>{actions(row, rowIndex)}</td> : null}{columns.map((column, displayIndex) => { const cell = row[column.index] ?? ""; const total = cell.startsWith("**"); const numeric = isNumeric(cell); const displayValue = total ? cell.replaceAll("*", "") : cell || "-"; return <td key={`${cell}-${column.index}`} style={displayIndex === 0 ? { left: actions ? 76 : 0 } : undefined} title={cell || undefined} className={`border-r border-slate-100 px-4 ${rowPadding} transition-colors ${displayIndex === 0 ? "sticky z-10 !border-slate-200 bg-white shadow-[8px_0_12px_-12px_rgba(15,23,42,.22)] group-hover:bg-[#F7FFFE]" : ""} ${numeric ? "text-right tabular-nums text-slate-600" : "text-slate-700"} ${total ? "font-bold text-slate-900" : ""}`}><span className={`block truncate ${!cell ? "text-slate-200" : ""}`}>{total ? <span className="rounded-md bg-teal/8 px-1.5 py-0.5">{displayValue}</span> : displayValue}</span></td>; })}</motion.tr>)}{visibleRows.length === 0 ? <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-5 py-16 text-center"><p className="text-[13px] font-semibold text-slate-600">{emptyMessage}</p><p className="mt-1 text-[12px] text-slate-400">Try changing the search term or restoring hidden columns.</p></td></tr> : null}</tbody>
    </table></div>
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[12px] text-slate-500">Showing <span className="font-semibold text-slate-700">{from}-{to}</span> of <span className="font-semibold text-slate-700">{filtered.length}</span><span className="ml-2 text-slate-300">•</span><span className="ml-2 text-slate-400">Scroll horizontally for more data</span></p><div className="flex items-center gap-2"><button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="focus-ring grid h-8 w-8 place-items-center rounded-[9px] bg-slate-100 text-slate-600 transition hover:bg-teal/10 hover:text-teal disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-16 rounded-[9px] bg-teal/10 px-3 py-1.5 text-center text-[11px] font-bold text-teal">{page + 1} / {pages}</span><button onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1} className="focus-ring grid h-8 w-8 place-items-center rounded-[9px] bg-slate-100 text-slate-600 transition hover:bg-teal/10 hover:text-teal disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div></div>
  </section>;
}
