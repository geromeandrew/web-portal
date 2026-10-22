import type { ReactNode } from "react";
import workspaceBackgroundIllustration from "../assets/workspace-background-illustration.png";

export const workspaceUi = {
  page: "relative isolate -mx-5 -my-10 min-h-[calc(100vh-72px)] overflow-hidden bg-[#f2f7fe] px-5 py-11 sm:-mx-8 sm:-my-12 sm:px-8 sm:py-12 lg:-mx-0 lg:-my-14 lg:px-0 lg:py-8",
  content: "relative mx-auto w-full max-w-none",
  title:
    "font-elliot text-[26px] font-bold leading-8 tracking-[-0.025em] text-[#0e1522] 2xl:text-[30px] 2xl:leading-10",
  description:
    "mt-1 font-elliot text-[13px] leading-5 text-[#1c2431] 2xl:text-[15px] 2xl:leading-6",
  grid: "mt-12 grid items-start gap-2 xl:grid-cols-[412fr_806fr] 2xl:mt-14 2xl:gap-3",
  panel:
    "overflow-hidden rounded-[8px] bg-white shadow-[0_2px_8px_rgba(20,47,89,0.08)] ring-1 ring-[#e4eaf2]",
  panelHeading:
    "font-elliot text-[11px] font-bold text-[#171b24] 2xl:text-[13px]",
  uploadPanel: "min-h-[529px] p-5 2xl:min-h-[600px] 2xl:p-6",
  activityPanel: "flex flex-col",
  activityBody: "overflow-x-auto",
  guidance:
    "mt-4 rounded-[5px] bg-[#f6f9fd] px-4 py-4 2xl:mt-5 2xl:px-5 2xl:py-5",
  cycleSelect:
    "focus-ring mt-3 h-[35px] w-full rounded-[5px] border border-[#b8c1cf] bg-white px-3 font-elliot text-[12px] text-[#5c6675] 2xl:mt-4 2xl:h-[42px] 2xl:px-4 2xl:text-[14px]",
  dropZone:
    "focus-ring mt-3 flex min-h-[267px] w-full flex-col items-center justify-center rounded-[5px] border border-dashed border-[#79baff] bg-[#f8fcff] px-6 text-center transition-colors 2xl:mt-5 2xl:min-h-[323px]",
  cycleMeta:
    "mt-2 font-elliot text-[10px] font-semibold text-[#087dca] 2xl:text-[12px]",
  activityHeader:
    "flex min-h-[37px] items-center justify-between gap-3 bg-[#e8eef8] px-6 2xl:min-h-[46px] 2xl:px-7",
  activityFilter:
    "focus-ring h-[25px] rounded-[3px] border border-[#b8c1cf] bg-white px-2 font-elliot text-[10px] text-[#252d39] 2xl:h-[31px] 2xl:px-3 2xl:text-[12px]",
  tableHead:
    "bg-[#f1f5fd] font-elliot text-[10px] font-bold uppercase text-[#4165a8] 2xl:text-[12px]",
  tableCell: "font-elliot text-[12px] text-[#171b24] 2xl:text-[14px]",
  successToast:
    "absolute left-1/2 top-[66px] z-20 flex -translate-x-1/2 items-center gap-2 rounded-[5px] bg-[#1fac6c] px-4 py-3 font-elliot text-[12px] text-white shadow-[0_5px_12px_rgba(22,104,68,0.18)] xl:left-[48%] 2xl:top-[82px] 2xl:px-5 2xl:py-4 2xl:text-[14px]",
  table: "w-full min-w-[600px] table-fixed border-collapse text-left",
  tableHeadingFirst: "px-7 py-3 2xl:px-8 2xl:py-4",
  tableHeading: "px-4 py-3 2xl:px-5 2xl:py-4",
  tableHeadingActions: "w-10 px-2 py-3 2xl:w-12 2xl:py-4",
  tableGroupName:
    "font-elliot text-[12px] text-[#171b24] 2xl:text-[14px] px-7 py-2.5 font-bold",
  tableUploader:
    "font-elliot text-[12px] text-[#171b24] 2xl:text-[14px] break-words px-4 py-3 leading-4",
  tableTimestamp:
    "font-elliot whitespace-normal px-4 py-3 text-[10px] leading-4 text-[#171b24] 2xl:text-[12px]",
  tableValue:
    "font-elliot text-[12px] text-[#171b24] 2xl:text-[14px] px-4 py-3",
  tablePlaceholder:
    "font-elliot text-[12px] text-[#8b96a6] 2xl:text-[14px] px-4 py-3",
  tableActions: "px-2 py-2.5",
  tableToggle: "focus-ring inline-flex items-center gap-3 rounded-sm",
  guidanceTitle:
    "flex items-center gap-2 font-elliot text-[12px] font-bold text-[#171b24] 2xl:gap-3 2xl:text-[14px]",
  guidanceIcon: "h-5 w-5 2xl:h-6 2xl:w-6",
  guidanceText:
    "mt-3 font-elliot text-[11px] leading-4 text-[#2a3240] 2xl:mt-4 2xl:text-[13px] 2xl:leading-5",
  guidanceList:
    "mt-1 list-disc space-y-0.5 pl-4 font-elliot text-[11px] leading-4 text-[#2a3240] 2xl:mt-2 2xl:space-y-1 2xl:pl-5 2xl:text-[13px] 2xl:leading-5",
  uploadIcon: "h-10 w-auto 2xl:h-14",
  uploadSpinner: "h-10 w-10 animate-spin text-[#4788f7] 2xl:h-14 2xl:w-14",
  uploadLabel:
    "mt-3 font-elliot text-[11px] font-bold text-[#087dca] 2xl:mt-4 2xl:text-[13px]",
  uploadHint: "font-elliot text-[11px] text-[#087dca] 2xl:text-[13px]",
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
