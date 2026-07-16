import { ArrowLeft, FileCog, Mic2 } from "lucide-react";
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
  if (selected) return <div className="space-y-5"><PageHeader eyebrow="APRM" title={selected.title} description={selected.description}><Link to="/aprm" className="focus-ring inline-flex items-center gap-2 text-[13px] font-semibold text-teal"><ArrowLeft className="h-4 w-4" />Back to APRM</Link></PageHeader><WorkflowUpload title={selected.title} description={selected.description} acceptLabel="Supported business files" /></div>;

  return <div className="space-y-5"><PageHeader eyebrow="APRM" title="APRM workflows" description="Select the Content or Voice workflow to upload the corresponding source files." /><section className="grid gap-5 sm:grid-cols-2">
    {areas.map((item) => { const Icon = item.icon; return <article key={item.id} className="rounded-2xl bg-white p-7 shadow-lg shadow-slate-200/60 ring-1 ring-slate-100"><span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal/15 to-sky-100 text-teal"><Icon className="h-5 w-5" /></span><h1 className="font-heading mt-6 text-[27px] font-bold tracking-tight text-slate-900">{item.title}</h1><p className="mt-2 text-[14px] text-slate-500">{item.description}</p><Link to={`/aprm/${item.id}`} className="focus-ring mt-5 inline-flex rounded-full bg-gradient-to-r from-teal to-sky-500 px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-teal/20 transition hover:-translate-y-0.5">Start processing <span className="ml-1">»</span></Link></article>; })}
  </section></div>;
}
