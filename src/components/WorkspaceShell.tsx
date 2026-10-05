import type { ReactNode } from "react";
import workspaceBackgroundIllustration from "../assets/workspace-background-illustration.png";

export const workspaceUi = {
  page: "relative isolate -mx-5 -my-10 min-h-[calc(100vh-72px)] overflow-hidden bg-[#f2f7fe] px-5 py-11 sm:-mx-8 sm:-my-12 sm:px-8 sm:py-12 lg:-mx-0 lg:-my-14 lg:px-0 lg:py-8",
  content: "relative mx-auto w-full max-w-none",
  title:
    "font-elliot text-[26px] font-bold leading-8 tracking-[-0.025em] text-[#0e1522] 2xl:text-[30px] 2xl:leading-10",
  description:
    "mt-1 font-elliot text-[13px] leading-5 text-[#1c2431] 2xl:text-[15px] 2xl:leading-6",
  panel:
    "overflow-hidden rounded-[8px] bg-white shadow-[0_2px_8px_rgba(20,47,89,0.08)] ring-1 ring-[#e4eaf2]",
  grid: "mt-12 grid items-start gap-2 xl:grid-cols-[412fr_806fr] 2xl:mt-14 2xl:gap-3",
  panelHeading:
    "font-elliot text-[11px] font-bold text-[#171b24] 2xl:text-[13px]",
  uploadPanel: "min-h-[529px] p-5 2xl:min-h-[600px] 2xl:p-6",
  guidance:
    "mt-4 rounded-[5px] bg-[#f6f9fd] px-4 py-4 2xl:mt-5 2xl:px-5 2xl:py-5",
  dropZone:
    "mt-4 flex min-h-[267px] w-full flex-col items-center justify-center rounded-[5px] border border-dashed border-[#79baff] bg-[#f8fcff] px-6 text-center transition-colors 2xl:mt-5 2xl:min-h-[323px]",
  activityHeader:
    "flex min-h-[37px] items-center bg-[#e8eef8] px-6 2xl:min-h-[46px] 2xl:px-7",
};

type WorkspaceShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  titleId?: string;
  headerAction?: ReactNode;
};

export default function WorkspaceShell({
  title,
  description,
  children,
  titleId = "workspace-title",
  headerAction,
}: WorkspaceShellProps) {
  return (
    <div className={workspaceUi.page}>
      <img
        src={workspaceBackgroundIllustration}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 hidden w-[31rem] object-contain opacity-60 lg:block"
      />
      <section className={workspaceUi.content} aria-labelledby={titleId}>
        <h1 id={titleId} className={workspaceUi.title}>
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className={workspaceUi.description}>{description}</p>
          {headerAction}
        </div>
        {children}
      </section>
    </div>
  );
}
