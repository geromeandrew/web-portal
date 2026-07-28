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

  return <div className="pb-10">
    <AnimatePresence>
      {welcomeOpen ? <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="relative isolate min-h-[500px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-mint via-[#eefafa] to-[#e7efff] px-7 py-12 shadow-[0_26px_80px_rgba(27,46,110,0.12)] ring-1 ring-white sm:px-12 sm:py-16 lg:min-h-[560px] lg:px-16 lg:py-20">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(rgba(21,153,160,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(21,153,160,.055)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_right,black,transparent_72%)]" />
        <button onClick={() => setWelcomeOpen(false)} className="focus-ring absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/70 text-slate-400 shadow-sm ring-1 ring-white/80 backdrop-blur transition hover:bg-white hover:text-slate-700 sm:right-7 sm:top-7" aria-label="Dismiss DT+ introduction"><X className="h-4 w-4" /></button>

        <div className="relative grid min-h-[360px] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-12">
          <motion.div initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08, duration: 0.5 }} className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-teal"><Sparkles className="h-3.5 w-3.5" />Data Transformation Plus</span>
            <h1 className="font-heading mt-7 text-7xl font-extrabold leading-none tracking-[-0.065em] text-slate-900 sm:text-8xl lg:text-[7.5rem]">DT<span className="text-teal">+</span></h1>
            <p className="mt-8 text-[16px] leading-8 text-slate-600 sm:text-[17px]">Data Transformation Plus (DT+) streamlines your data management, offering a dynamic platform for enhancing your Extract, Transform, Load (ETL) processes. Simplify data uploads, monitor workflows, and execute tasks with ease, all through our intuitive interface.</p>
            <a href="#modules" className="focus-ring mt-9 inline-flex h-12 items-center gap-3 rounded-full bg-gradient-to-r from-teal to-sky-500 px-6 text-[14px] font-semibold text-white shadow-[0_14px_32px_rgba(21,153,160,.28)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(21,153,160,.34)]">Learn more <ArrowRight className="h-4 w-4" /></a>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.16, duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="relative mx-auto hidden aspect-square w-full max-w-[220px] place-items-center lg:grid" aria-hidden="true">
            <div className="absolute inset-0 rounded-full border border-navy/15 bg-white/20" />
            <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal" />
            <div className="absolute inset-x-12 top-1/2 h-px bg-navy/10" />
            <div className="relative font-heading text-3xl font-extrabold tracking-[-0.06em] text-navy">DT<span className="text-teal">+</span></div>
          </motion.div>
        </div>
      </motion.section> : null}
    </AnimatePresence>

    <section id="modules" className={welcomeOpen ? "pt-24 sm:pt-28" : "pt-4"}>
      <div className="mb-10 sm:mb-14"><p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-teal">DT+ Modules</p><h2 className="font-heading mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Choose a workflow to begin.</h2></div>
      <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_70px_rgba(27,46,110,0.09)] ring-1 ring-slate-200/70 lg:grid lg:grid-cols-3">
        {modules.map((module, index) => <motion.div key={module.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: index * 0.08, duration: 0.4 }} className="border-b border-slate-100 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
          <Link to={module.to} className="group flex min-h-[330px] flex-col px-7 py-9 transition duration-300 hover:bg-gradient-to-b hover:from-teal/[0.035] hover:to-sky-50/60 sm:px-9 sm:py-11">
            <div className="flex items-center justify-between"><span className="h-px w-12 bg-gradient-to-r from-teal/50 to-transparent" /><span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal/15 to-sky-100 text-teal transition duration-300 group-hover:scale-105 group-hover:bg-teal group-hover:text-white"><Layers3 className="h-5 w-5" /></span></div>
            <h3 className="font-heading mt-12 text-xl font-bold text-slate-900 sm:text-[22px]">{module.title}</h3>
            <p className="mt-4 text-[14px] leading-7 text-slate-500">{module.description}</p>
            <div className="mt-auto flex items-end justify-between gap-4 border-t border-slate-100 pt-7"><span className="max-w-[12rem] text-[12px] leading-5 text-slate-400">{module.detail}</span><span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-teal">Start processing <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div>
          </Link>
        </motion.div>)}
      </div>
    </section>
  </div>;
}
