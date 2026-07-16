import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Layers3, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const modules = [
  { title: "Prepaid Reclass", description: "Prepaid Reclass features file upload, import and manual data inputs.", to: "/prepaid/file-upload", detail: "Source templates and layouts" },
  { title: "MemoApp SST", description: "Memo App Standard Source Templates features file upload and error or exception monitoring.", to: "/memo/file-upload", detail: "Template and exception review" },
  { title: "APRM", description: "APRM features file upload.", to: "/aprm", detail: "Content and Voice workflows" },
];

export default function DashboardRoute() {
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  return <div className="space-y-12 pb-8">
    <AnimatePresence>{welcomeOpen ? <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal/18 via-sky-100 to-[#EDEAFF] px-6 py-10 shadow-panel sm:px-10 sm:py-14">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-[4rem] bg-teal/20 blur-3xl" /><div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-[5rem] bg-sky-400/20 blur-3xl" />
      <button onClick={() => setWelcomeOpen(false)} className="focus-ring absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/70 text-slate-400 transition hover:bg-white hover:text-slate-700" aria-label="Dismiss DT+ introduction"><X className="h-4 w-4" /></button>
      <div className="relative max-w-4xl"><span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-[12px] font-semibold text-teal ring-1 ring-teal/15"><Sparkles className="h-3.5 w-3.5" />Data Transformation Plus</span><h1 className="font-heading mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">DT<span className="text-teal">+</span></h1><p className="mt-5 max-w-4xl text-[16px] leading-7 text-slate-600">Data Transformation Plus (DT+) streamlines your data management, offering a dynamic platform for enhancing your Extract, Transform, Load (ETL) processes. Simplify data uploads, monitor workflows, and execute tasks with ease, all through our intuitive interface.</p><a href="#modules" className="focus-ring mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-teal to-sky-500 px-5 text-[14px] font-semibold text-white shadow-lg shadow-teal/20 transition hover:-translate-y-0.5">Learn more <ArrowRight className="h-4 w-4" /></a></div>
    </motion.section> : null}</AnimatePresence>
    <section id="modules"><div className="flex items-end justify-between gap-6"><div><p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-teal">DT+ Modules</p><h2 className="font-heading mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Choose a workflow to begin.</h2></div></div><div className="mt-7 grid gap-5 lg:grid-cols-3">{modules.map((module, index) => <motion.div key={module.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}><Link to={module.to} className="group block h-full rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/60 ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-xl"><span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal/15 to-sky-100 text-teal"><Layers3 className="h-5 w-5" /></span><h3 className="font-heading mt-6 text-[18px] font-bold text-slate-900">{module.title}</h3><p className="mt-2 min-h-12 text-[13px] leading-6 text-slate-500">{module.description}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-[12px] text-slate-400">{module.detail}</span><span className="inline-flex items-center gap-1 text-[13px] font-semibold text-teal">Start processing <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div></Link></motion.div>)}</div></section>
  </div>;
}
