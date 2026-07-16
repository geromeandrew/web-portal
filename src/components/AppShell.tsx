import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, CloudUpload, Menu, Upload, X, Zap } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "../lib/utils";
import { useUploadMode } from "../lib/uploadMode";

const links = [
  { to: "/", label: "DT+ Home", end: true },
  { to: "/prepaid/file-upload", label: "Prepaid Systems" },
  { to: "/memo/file-upload", label: "MemoApp SST" },
  { to: "/aprm", label: "APRM" },
];

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const { uploadMode, setUploadMode } = useUploadMode();
  return <div className="min-h-screen bg-[#F7FBFC] text-slate-800">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-7">
        <NavLink to="/" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal to-sky-500 text-xs font-bold text-white shadow-lg shadow-teal/20">DT</span><span className="font-heading text-[18px] font-bold tracking-tight text-slate-900">DT<span className="text-teal">+</span></span></NavLink>
        <nav className="hidden h-full items-center gap-6 lg:flex" aria-label="Primary navigation">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => cn("relative flex h-full items-center text-[13px] font-medium transition", isActive ? "text-teal" : "text-slate-500 hover:text-teal")}>{({ isActive }) => <>{link.label}{isActive ? <motion.span layoutId="active-nav" className="absolute bottom-0 inset-x-0 h-0.5 rounded-full bg-gradient-to-r from-teal to-sky-500" /> : null}</>}</NavLink>)}</nav>
        <div className="relative flex items-center gap-3"><p className="hidden text-[12px] text-slate-500 xl:block">Hello, GLOBETEL\ve260594!</p><button onClick={() => setTransferOpen((open) => !open)} className="focus-ring inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-teal to-sky-500 px-3.5 text-[12px] font-semibold text-white shadow-lg shadow-teal/20 transition hover:-translate-y-0.5 hover:shadow-xl" aria-expanded={transferOpen} aria-haspopup="menu"><Upload className="h-4 w-4" /><span className="hidden sm:inline">{uploadMode === "lambda" ? "Lambda upload" : "Direct S3"}</span><ChevronDown className={`h-3.5 w-3.5 transition ${transferOpen ? "rotate-180" : ""}`} /></button><button onClick={() => setMenuOpen((value) => !value)} className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 lg:hidden" aria-label="Toggle navigation">{menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button><AnimatePresence>{transferOpen ? <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.18, ease: "easeOut" }} className="absolute right-0 top-12 z-50 w-[320px] overflow-hidden rounded-2xl border border-white bg-white p-2 shadow-[0_22px_55px_rgba(21,76,112,0.18)]" role="menu"><div className="px-3 pb-2 pt-2"><p className="text-[13px] font-semibold text-slate-900">Transfer method</p><p className="mt-0.5 text-[11px] text-slate-500">Applied across every upload workflow.</p></div>{(["direct", "lambda"] as const).map((mode) => { const active = uploadMode === mode; const Icon = mode === "direct" ? CloudUpload : Zap; return <button key={mode} onClick={() => { setUploadMode(mode); setTransferOpen(false); }} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${active ? "bg-gradient-to-r from-teal/10 to-sky-50" : "hover:bg-slate-50"}`} role="menuitem"><span className={`grid h-9 w-9 place-items-center rounded-[10px] ${active ? "bg-gradient-to-br from-teal to-sky-500 text-white" : "bg-slate-100 text-sky-600"}`}><Icon className="h-4 w-4" /></span><span className="flex-1"><span className="block text-[13px] font-semibold text-slate-800">{mode === "direct" ? "Direct S3 upload" : "Lambda upload"}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{mode === "direct" ? "Batch uploads with presigned browser transfers." : "One small file routed through the secure transfer service."}</span></span>{active ? <Check className="mt-2 h-4 w-4 text-teal" /> : null}</button>; })}</motion.div> : null}</AnimatePresence></div>
      </div>
      <AnimatePresence>{menuOpen ? <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 bg-white px-5 lg:hidden">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => cn("block border-b border-slate-100 py-3 text-[13px] font-medium", isActive ? "text-teal" : "text-slate-600")}>{link.label}</NavLink>)}</motion.nav> : null}</AnimatePresence>
    </header>
    <main className="mx-auto min-h-[calc(100vh-10rem)] max-w-7xl px-5 py-6 sm:px-7 sm:py-8"><Outlet /></main>
    <footer className="mx-auto max-w-7xl border-t border-slate-200 px-5 py-6 text-[13px] text-slate-600 sm:px-7">© 2026 - Enterprise Services Applications</footer>
  </div>;
}
