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

const moduleByWorkspaceId: Record<string, string> = {
  "bss-bill-cycle-globe": "bss_billcycle_glob", "bss-bill-cycle-innove": "bss_billcycle_inov", "bss-bill-cycle-bayan": "bss_billcycle_bayn",
  "bss-eom-globe": "bss_eom_glob", "bss-eom-innove": "bss_eom_inov", "bss-eom-bayan": "bss_eom_bayn",
  "memo-stt": "memo_sst", "iccbs-innove": "iccbs_inov", "iccbs-bayan": "iccbs_bayn",
  "aprm-voice-accrual": "aprm_voice_accrual", "aprm-voice-delta": "aprm_voice_delta",
  "isms-ibob-actualization": "isms_ibob_actzn", "isms-iot-discount": "isms_iot_da",
  north: "north", "prepaid-re-class": "prepaid_reclass",
};

export function workspaceModuleId(workspace: WorkspaceDefinition) {
  return moduleByWorkspaceId[workspace.id] ?? null;
}

export function allowedWorkspaces(moduleIds: readonly string[]) {
  const allowed = new Set(moduleIds);
  return workspaces.filter((workspace) => {
    const moduleId = workspaceModuleId(workspace);
    return moduleId ? allowed.has(moduleId) : workspace.id === "aprm-content";
  });
}

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
