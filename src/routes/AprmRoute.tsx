import { ArrowRight } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import PageHeader from "../components/PageHeader";
import { allowedWorkspaces, workspaceHref } from "../lib/workspaces";

export default function AprmRoute() {
  const { area } = useParams();
  const { user } = useAuth();
  const available = allowedWorkspaces(
    user?.modules?.map((module) => module.moduleId) ?? [],
  ).filter((workspace) => workspace.id.startsWith("aprm-voice-"));
  if ((area && area !== "voice") || !available.length)
    return <Navigate to="/" replace />;
  return (
    <div className="space-y-10 pb-4">
      <PageHeader
        eyebrow="APRM"
        title="APRM Voice"
        description="Select the processing pipeline for the source files you need to upload."
      />
      <section className="grid gap-6 sm:grid-cols-2">
        {available.map((workspace) => (
          <Link
            key={workspace.id}
            to={workspaceHref(workspace)}
            className="portal-panel block p-8 transition hover:ring-2 hover:ring-teal/30"
          >
            <h2 className="font-heading text-xl font-bold text-slate-900">
              {workspace.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {workspace.description}
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-teal">
              Open upload workspace <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
