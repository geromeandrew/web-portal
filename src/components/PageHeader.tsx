import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
};

export default function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return <section className="portal-page-header">
    <div className="portal-page-glow" />
    <div className="absolute -bottom-24 right-10 -z-10 h-56 w-56 rounded-full border-[36px] border-white/35" />
    <div className="relative flex min-h-[150px] flex-col justify-center"><p className="portal-eyebrow flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal" />{eyebrow}</p><h1 className="font-heading mt-3 text-[28px] font-bold tracking-tight text-slate-900 sm:text-[34px]">{title}</h1>{description ? <p className="mt-3 max-w-3xl text-[14px] leading-7 text-slate-600">{description}</p> : null}{children ? <div className="mt-7">{children}</div> : null}</div>
  </section>;
}
