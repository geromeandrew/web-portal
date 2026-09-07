export type WorkspaceDefinition = {
  id: string;
  title: string;
  description: string;
  kind: "pipeline" | "route";
  to?: string;
  pipelineTerms?: readonly string[];
  presentation?: "billCycle";
};

export type PipelineOption = {
  code: string;
  label: string;
};

export const workspaces: readonly WorkspaceDefinition[] = [
  {
    id: "bss-bill-cycle-globe",
    title: "BSS Bill Cycle - Globe",
    description: "Billing cycle dataset upload for Globe enterprise consumer & business accounts",
    kind: "pipeline",
    presentation: "billCycle",
    pipelineTerms: ["bss", "bill", "globe"],
  },
  {
    id: "bss-bill-cycle-innove",
    title: "BSS Bill Cycle - Innove",
    description: "Billing cycle dataset upload for Innove enterprise consumer & business accounts",
    kind: "pipeline",
    presentation: "billCycle",
    pipelineTerms: ["bss", "bill", "innove"],
  },
  {
    id: "bss-bill-cycle-bayan",
    title: "BSS Bill Cycle - Bayan",
    description: "Billing cycle dataset upload for Bayan enterprise consumer & business accounts",
    kind: "pipeline",
    presentation: "billCycle",
    pipelineTerms: ["bss", "bill", "bayan"],
  },
  {
    id: "aprm-content",
    title: "APRM - Content",
    description: "Upload source files for digital content revenue settlements",
    kind: "route",
    to: "/aprm/content",
  },
  {
    id: "memo-stt",
    title: "Memo STT",
    description: "Standardized ingestion for uploading and processing manual billing memo adjustments",
    kind: "route",
    to: "/memo/file-upload",
  },
  {
    id: "prepaid-re-class",
    title: "Prepaid Re-Class",
    description: "Ad-hoc workflow for importing, reviewing, and applying prepaid revenue reclassifications",
    kind: "route",
    to: "/prepaid/file-upload",
  },
];

export function workspaceHref(workspace: WorkspaceDefinition) {
  if (workspace.kind === "route") return workspace.to!;
  return `/processing-pipelines?${new URLSearchParams({ workspace: workspace.id })}`;
}

export function isBillCycleWorkspace(workspace: WorkspaceDefinition | undefined): workspace is WorkspaceDefinition & { presentation: "billCycle" } {
  return workspace?.presentation === "billCycle";
}

export function resolveWorkspacePipelineCode(
  workspaceId: string,
  pipelines: readonly PipelineOption[],
) {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace?.pipelineTerms?.length) return null;

  return pipelines.find((pipeline) => {
    const label = normalizeWorkspaceText(pipeline.label);
    return workspace.pipelineTerms!.every((term) => label.includes(normalizeWorkspaceText(term)));
  })?.code ?? null;
}

function normalizeWorkspaceText(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
