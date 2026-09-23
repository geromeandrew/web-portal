export type WorkspaceDefinition = {
  id: string;
  title: string;
  description: string;
  kind: "pipeline" | "route";
  to?: string;
  dashboardHref?: string;
  pipelineTerms?: readonly string[];
  presentation?: "billCycle";
};

export type PipelineOption = {
  code: string;
  label: string;
};

export const prepaidWorkspaceHref = "/prepaid/file-upload";

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
    id: "bss-eom-globe",
    title: "BSS EOM - Globe",
    description: "Month-end billing source-file processing for Globe.",
    kind: "pipeline",
    pipelineTerms: ["bss", "eom", "globe"],
  },
  {
    id: "bss-eom-innove",
    title: "BSS EOM - Innove",
    description: "Month-end billing source-file processing for Innove.",
    kind: "pipeline",
    pipelineTerms: ["bss", "eom", "innove"],
  },
  {
    id: "bss-eom-bayan",
    title: "BSS EOM - Bayan",
    description: "Month-end billing source-file processing for Bayan.",
    kind: "pipeline",
    pipelineTerms: ["bss", "eom", "bayan"],
  },
  {
    id: "aprm-content",
    title: "APRM - Content",
    description: "Upload source files for digital content revenue settlements",
    kind: "route",
    to: "/aprm/content",
    pipelineTerms: ["aprm", "content"],
  },
  {
    id: "memo-stt",
    title: "Memo STT",
    description: "Standardized ingestion for uploading and processing manual billing memo adjustments",
    kind: "route",
    to: "/memo/file-upload",
    pipelineTerms: ["memo", "standard", "template"],
  },
  {
    id: "iccbs-innove",
    title: "ICCBS - Innove",
    description: "ICCBS financial and transaction source-file processing for Innove.",
    kind: "pipeline",
    pipelineTerms: ["iccbs", "innove"],
  },
  {
    id: "iccbs-bayan",
    title: "ICCBS - Bayan",
    description: "ICCBS financial and transaction source-file processing for Bayan.",
    kind: "pipeline",
    pipelineTerms: ["iccbs", "bayan"],
  },
  {
    id: "aprm-voice-accrual",
    title: "APRM Voice - Accrual",
    description: "APRM voice accrual source-file processing.",
    kind: "pipeline",
    pipelineTerms: ["aprm", "voice", "accrual"],
  },
  {
    id: "aprm-voice-delta",
    title: "APRM Voice - Delta",
    description: "APRM voice delta source-file processing.",
    kind: "pipeline",
    pipelineTerms: ["aprm", "voice", "delta"],
  },
  {
    id: "isms-ibob-actualization",
    title: "ISMS IBOB Actualization",
    description: "ISMS IBOB actualization source-file processing.",
    kind: "pipeline",
    pipelineTerms: ["isms", "ibob", "actualization"],
  },
  {
    id: "isms-iot-discount",
    title: "ISMS IOT Discount",
    description: "ISMS IOT discount source-file processing.",
    kind: "pipeline",
    pipelineTerms: ["isms", "iot", "discount"],
  },
  {
    id: "north",
    title: "North",
    description: "North operational source-file processing.",
    kind: "pipeline",
    pipelineTerms: ["north"],
  },
  {
    id: "prepaid-re-class",
    title: "Prepaid Re-Class",
    description: "Ad-hoc workflow for importing, reviewing, and applying prepaid revenue reclassifications",
    kind: "route",
    to: prepaidWorkspaceHref,
    pipelineTerms: ["prepaid", "reclass"],
  },
];

const dashboardWorkspaceIds = new Set([
  "bss-bill-cycle-globe", "bss-bill-cycle-innove", "bss-bill-cycle-bayan",
  "aprm-content", "memo-stt", "prepaid-re-class",
]);
export const dashboardWorkspaces = workspaces.filter((workspace) => dashboardWorkspaceIds.has(workspace.id));

export function workspaceHref(workspace: WorkspaceDefinition) {
  if (workspace.kind === "route") return workspace.to!;
  return `/processing-pipelines?${new URLSearchParams({ workspace: workspace.id })}`;
}

export function dashboardWorkspaceHref(workspace: WorkspaceDefinition) {
  return workspace.dashboardHref ?? workspaceHref(workspace);
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
