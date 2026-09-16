import { ArrowLeft, ArrowRight, FileCog, Mic2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import WorkflowUpload from "../components/WorkflowUpload";

const areas = [
  { id: "content", title: "APRM Content", description: "APRM Content features file upload.", icon: FileCog },
  { id: "voice", title: "APRM Voice", description: "APRM Voice features file upload.", icon: Mic2 },
] as const;

export default function AprmRoute() {
  const { area } = useParams();
  const selected = areas.find((item) => item.id === area);

  if (selected) return <div className="space-y-8 pb-4"><PageHeader eyebrow="APRM" title={selected.title} description={selected.description}><Link to="/aprm" className="focus-ring inline-flex items-center gap-2 rounded-lg text-[13px] font-semibold text-teal"><ArrowLeft className="h-4 w-4" />Back to APRM</Link></PageHeader><WorkflowUpload title={selected.title} description={selected.description} acceptLabel="Supported business files" /></div>;

  return <div className="space-y-10 pb-4">
    <PageHeader eyebrow="APRM" title="APRM workflows" description="Select the Content or Voice workflow to upload the corresponding source files." />
    <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_70px_rgba(27,46,110,0.09)] ring-1 ring-slate-200/70 sm:grid sm:grid-cols-2">
      {areas.map((item) => { const Icon = item.icon; return <Link key={item.id} to={`/aprm/${item.id}`} className="group flex min-h-[350px] flex-col border-b border-slate-100 p-8 transition duration-300 hover:bg-gradient-to-br hover:from-teal/[0.035] hover:to-sky-50/70 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-10 lg:p-12"><div className="flex items-center justify-between"><span className="h-px w-12 bg-gradient-to-r from-teal/50 to-transparent" /><span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal/15 to-sky-100 text-teal transition duration-300 group-hover:bg-teal group-hover:text-white"><Icon className="h-6 w-6" /></span></div><h2 className="font-heading mt-14 text-[27px] font-bold tracking-tight text-slate-900">{item.title}</h2><p className="mt-4 text-[14px] leading-7 text-slate-500">{item.description}</p><span className="mt-auto inline-flex items-center gap-2 pt-10 text-[14px] font-semibold text-teal">Start processing <span>»</span><ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></Link>; })}
    </section>
  </div>;
}
