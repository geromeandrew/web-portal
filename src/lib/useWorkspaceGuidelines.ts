import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "./apiClient";
import type { ProcessingPipelineFileDto } from "./apiTypes";

type Requirement = {
  id: number;
  fileName: string;
  match: "exact" | "glob";
  legacyPackageName: string | null;
  jobName: string | null;
  stepFunction: ProcessingPipelineFileDto["stepFunction"];
};

/** Guidelines can render before the storage inventory is ready. They never
 * authorize an upload or supply replacement flags; those use the live files. */
export function useWorkspaceGuidelines(pipelineCode: string | null) {
  const [guidelines, setGuidelines] = useState<ProcessingPipelineFileDto[]>([]);
  const [loading, setLoading] = useState(false);
  const currentCode = useRef(pipelineCode);
  currentCode.current = pipelineCode;
  const inventoryLoadedFor = useRef<string | null>(null);

  const acceptInventory = useCallback(
    (code: string, files: ProcessingPipelineFileDto[]) => {
      if (currentCode.current && code !== currentCode.current) return;
      inventoryLoadedFor.current = code;
      setGuidelines(files);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (!pipelineCode) return;
    if (inventoryLoadedFor.current === pipelineCode) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    inventoryLoadedFor.current = null;
    setLoading(true);
    setGuidelines([]);
    void apiRequest<{ requirements: Requirement[] }>(
      `/processing-pipelines/${encodeURIComponent(pipelineCode)}/requirements?purpose=web-upload`,
      { signal: controller.signal },
    )
      .then(({ requirements }) => {
        if (
          controller.signal.aborted ||
          inventoryLoadedFor.current === pipelineCode
        )
          return;
        setGuidelines(
          // Older APIs may ignore purpose. Keep SAP outputs out of portal
          // guidelines during a rolling API/UI deployment as well.
          requirements
            .filter(
              (requirement) =>
                !(
                  ["aprm_voice_accrual", "aprm_voice_delta"].includes(
                    pipelineCode,
                  ) && /^ICEXT_.*_OUTPUT\.TXT$/i.test(requirement.fileName)
                ),
            )
            .map((requirement) => ({
              id: `requirement-${requirement.id}`,
              expectedFileName: requirement.fileName,
              match: requirement.match,
              legacyPackageName: requirement.legacyPackageName,
              jobName: requirement.jobName,
              stepFunction: requirement.stepFunction,
              availability: "missing",
              matchedFileName: null,
              key: null,
              size: null,
              lastModified: null,
            })),
        );
      })
      .catch(() => {
        // Older API deployments or unavailable metadata still use the existing
        // inventory response as their source of guidelines.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [pipelineCode]);

  return { guidelines, loadingGuidelines: loading, acceptInventory };
}
