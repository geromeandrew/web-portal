import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, ShieldCheck, UserRound, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { cn } from "../lib/utils";

const links = [
  { to: "/", label: "DT+ Home", end: true },
  { to: "/prepaid/file-upload", label: "Prepaid Systems" },
  { to: "/memo/file-upload", label: "MemoApp SST" },
  { to: "/aprm", label: "APRM" },
];

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { logout, user } = useAuth();

  return <div className="min-h-screen text-slate-800">
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-10">
        <NavLink to="/" className="focus-ring flex items-center gap-3 rounded-xl" aria-label="DT+ Home">
          <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br from-navy via-teal to-sky-500 text-xs font-extrabold text-white shadow-[0_10px_24px_rgba(21,153,160,.25)]">DT</span>
          <span className="font-heading text-[20px] font-bold tracking-tight text-slate-900">DT<span className="text-teal">+</span></span>
        </NavLink>

        <nav className="hidden h-full items-center gap-2 lg:flex" aria-label="Primary navigation">
          {links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => cn("focus-ring relative flex h-full items-center rounded-lg px-3.5 text-[13px] font-semibold transition duration-200", isActive ? "text-teal" : "text-slate-500 hover:text-slate-900")}>{({ isActive }) => <>{link.label}{isActive ? <motion.span layoutId="active-nav" transition={{ type: "spring", stiffness: 430, damping: 34 }} className="absolute bottom-0 inset-x-3.5 h-0.5 rounded-full bg-gradient-to-r from-teal to-sky-500" /> : null}</>}</NavLink>)}
        </nav>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70 xl:flex"><span className="grid h-7 w-7 place-items-center rounded-lg bg-teal/10 text-teal"><UserRound className="h-3.5 w-3.5" /></span><span className="max-w-44 truncate text-[12px] font-medium text-slate-600">{user?.email}</span></div>
          {user?.isBootstrapAdmin ? <NavLink to="/admin/users" className="focus-ring hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-teal transition hover:bg-teal/5 lg:inline-flex"><ShieldCheck className="h-4 w-4" />Users</NavLink> : null}
          <button onClick={() => void logout()} className="focus-ring grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-teal/25 hover:bg-teal/5 hover:text-teal" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          <button onClick={() => setMenuOpen((value) => !value)} className="focus-ring grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 lg:hidden" aria-label="Toggle navigation" aria-expanded={menuOpen}>{menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
        </div>
      </div>

      <AnimatePresence>{menuOpen ? <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden border-t border-slate-100 bg-white px-5 sm:px-8 lg:hidden" aria-label="Primary navigation"><div className="space-y-1 py-3">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => cn("block rounded-xl px-4 py-3.5 text-[13px] font-semibold", isActive ? "bg-teal/8 text-teal" : "text-slate-600 hover:bg-slate-50")}>{link.label}</NavLink>)}</div></motion.nav> : null}</AnimatePresence>
    </header>

    <main className="mx-auto min-h-[calc(100vh-12rem)] max-w-[90rem] px-5 py-10 sm:px-8 sm:py-12 lg:px-10 lg:py-14"><Outlet /></main>
    <footer className="mx-auto max-w-[90rem] border-t border-slate-200/80 px-5 py-8 text-[13px] text-slate-600 sm:px-8 lg:px-10">© 2026 - Enterprise Services Applications</footer>
  </div>;
}
