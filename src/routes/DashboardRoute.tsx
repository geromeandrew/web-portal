import { FileUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getUserFirstName } from "../lib/userDisplay";
import { workspaces, workspaceHref, type WorkspaceDefinition } from "../lib/workspaces";
import workspaceBackgroundIllustration from "../assets/workspace-background-illustration.png";

const dashboardUi = {
  page: "relative isolate -mx-5 -my-10 min-h-[calc(100vh-72px)] overflow-hidden bg-[#f2f7fe] px-5 py-16 sm:-mx-8 sm:-my-12 sm:px-8 lg:-mx-0 lg:-my-14 lg:px-0 lg:py-16",
  content: "relative mx-auto w-full max-w-none",
  heading: "font-elliot text-[24px] font-bold leading-8 tracking-[-0.025em] text-[#0e1522]",
  description: "mt-1 font-elliot text-[13px] leading-5 text-[#1c2431]",
  grid: "mt-11 grid gap-3 md:grid-cols-2 xl:grid-cols-3",
  card: "flex min-h-[212px] flex-col rounded-[10px] bg-white px-8 py-7 shadow-[0_3px_8px_rgba(20,47,89,0.09)] ring-1 ring-[#e8edf5]",
  cardHeader: "flex items-start justify-between gap-4",
  cardTitle: "font-elliot text-[15px] font-bold leading-5 text-[#121926]",
  cardDescription: "mt-1 font-elliot text-[13px] leading-[1.35] text-[#252c37]",
  icon: "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f0f7ff] text-[#087dca]",
  action: "focus-ring mt-auto inline-flex h-[36px] w-full items-center justify-center rounded-[5px] bg-[#087dca] px-4 font-elliot text-[11px] font-medium text-white transition-colors hover:bg-[#0674bb]",
};

function DashboardBackgroundIllustration() {
  return (
    <img src={workspaceBackgroundIllustration} alt="" aria-hidden="true" className="pointer-events-none absolute right-0 top-0 hidden w-[31rem] object-contain opacity-60 lg:block" />
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceDefinition }) {
  return (
    <article className={dashboardUi.card}>
      <div className={dashboardUi.cardHeader}>
        <div>
          <h2 className={dashboardUi.cardTitle}>{workspace.title}</h2>
          <p className={dashboardUi.cardDescription}>{workspace.description}</p>
        </div>
        <span className={dashboardUi.icon} aria-hidden="true"><FileUp className="h-4 w-4" /></span>
      </div>
      <Link to={workspaceHref(workspace)} className={dashboardUi.action}>Open workspace</Link>
    </article>
  );
}

export default function DashboardRoute() {
  const { user } = useAuth();

  return (
    <div className={dashboardUi.page}>
      <DashboardBackgroundIllustration />
      <section className={dashboardUi.content} aria-labelledby="dashboard-greeting">
        <h1 id="dashboard-greeting" className={dashboardUi.heading}>Hello, {getUserFirstName(user?.email)}!</h1>
        <p className={dashboardUi.description}>Select an authorized pipeline workspace below to upload files or manage executions</p>
        <div className={dashboardUi.grid}>
          {workspaces.map((workspace) => <WorkspaceCard key={workspace.id} workspace={workspace} />)}
        </div>
      </section>
    </div>
  );
}
