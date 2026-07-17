import { AnimatePresence, motion } from "framer-motion";
import { Menu, Upload, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "../lib/utils";

const links = [
  { to: "/", label: "DT+ Home", end: true },
  { to: "/prepaid/file-upload", label: "Prepaid Systems" },
  { to: "/memo/file-upload", label: "MemoApp SST" },
  { to: "/aprm", label: "APRM" },
];

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return <div className="min-h-screen bg-[#F7FBFC] text-slate-800">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-7">
        <NavLink to="/" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal to-sky-500 text-xs font-bold text-white shadow-lg shadow-teal/20">DT</span><span className="font-heading text-[18px] font-bold tracking-tight text-slate-900">DT<span className="text-teal">+</span></span></NavLink>
        <nav className="hidden h-full items-center gap-6 lg:flex" aria-label="Primary navigation">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => cn("relative flex h-full items-center text-[13px] font-medium transition", isActive ? "text-teal" : "text-slate-500 hover:text-teal")}>{({ isActive }) => <>{link.label}{isActive ? <motion.span layoutId="active-nav" className="absolute bottom-0 inset-x-0 h-0.5 rounded-full bg-gradient-to-r from-teal to-sky-500" /> : null}</>}</NavLink>)}</nav>
        <div className="flex items-center gap-3"><span className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-teal to-sky-500 px-3.5 text-[12px] font-semibold text-white shadow-lg shadow-teal/20"><Upload className="h-4 w-4" /><span className="hidden sm:inline">Lambda upload</span></span><button onClick={() => setMenuOpen((value) => !value)} className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 lg:hidden" aria-label="Toggle navigation">{menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button></div>
      </div>
      <AnimatePresence>{menuOpen ? <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 bg-white px-5 lg:hidden">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => cn("block border-b border-slate-100 py-3 text-[13px] font-medium", isActive ? "text-teal" : "text-slate-600")}>{link.label}</NavLink>)}</motion.nav> : null}</AnimatePresence>
    </header>
    <main className="mx-auto min-h-[calc(100vh-10rem)] max-w-7xl px-5 py-6 sm:px-7 sm:py-8"><Outlet /></main>
    <footer className="mx-auto max-w-7xl border-t border-slate-200 px-5 py-6 text-[13px] text-slate-600">© 2026 - Enterprise Services Applications</footer>
  </div>;
}
