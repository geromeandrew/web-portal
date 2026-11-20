import { Check, History } from "lucide-react";
import WorkspaceShell, { workspaceUi } from "../components/WorkspaceShell";
import { usePrepaidWorkspace } from "../features/prepaid/hooks/usePrepaidWorkspace";
import { PrepaidWorkspaceStatus } from "../features/prepaid/components/PrepaidWorkspaceStatus";
import { PrepaidUploadPanel } from "../features/prepaid/components/PrepaidUploadPanel";
import { PrepaidReviewPanel } from "../features/prepaid/components/PrepaidReviewPanel";
import { PrepaidWorkspaceDialogs } from "../features/prepaid/components/PrepaidWorkspaceDialogs";
import { PrepaidAwsBatch } from "../features/prepaid/components/PrepaidAwsBatch";
import "./prepaid.css";

export default function PrepaidRoute() {
  const workspace = usePrepaidWorkspace();
  return (
    <WorkspaceShell
      title="Prepaid Re-Class"
      description="Ad-hoc workflow for importing, reviewing, and applying prepaid revenue reclassifications"
      contentClassName="pp-workspace font-elliot text-[12px] text-[#171b24] 2xl:text-[14px]"
      headerAction={
        <button className="pp-link text-[12px] 2xl:text-[14px]" disabled={workspace.busy} onClick={workspace.openHistory}>
          <History size={14} />
          History
        </button>
      }
    >
      <PrepaidWorkspaceStatus workspace={workspace} />
      {workspace.awsBatchEnabled ? (
        <>
          <PrepaidAwsBatch workspace={workspace} processingWorkspace={workspace} />
          {workspace.stage === 1 && <PrepaidUploadPanel workspace={workspace} />}
        </>
      ) : workspace.stage === 1 ? (
        <PrepaidUploadPanel workspace={workspace} />
      ) : (
        <PrepaidReviewPanel workspace={workspace} />
      )}
      {workspace.toast && workspace.stage === 1 && (
        <div className={`pp-toast ${workspaceUi.successToast}`} role="status">
          <Check size={18} />
          <span>{workspace.toast}</span>
        </div>
      )}
      <PrepaidWorkspaceDialogs workspace={workspace} />
    </WorkspaceShell>
  );
}
