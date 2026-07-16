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
    <div className="relative"><p className="portal-eyebrow">{eyebrow}</p><h1 className="font-heading mt-2 text-[25px] font-bold tracking-tight text-slate-900 sm:text-[29px]">{title}</h1>{description ? <p className="mt-2 max-w-3xl text-[13px] leading-6 text-slate-600">{description}</p> : null}{children ? <div className="mt-5">{children}</div> : null}</div>
  </section>;
}
