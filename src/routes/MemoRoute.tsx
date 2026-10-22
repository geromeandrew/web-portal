import MappedUploadWorkspace from "../components/MappedUploadWorkspace";
import { workspaces } from "../lib/workspaces";

export default function MemoRoute() {
  return (
    <MappedUploadWorkspace
      workspace={workspaces.find((workspace) => workspace.id === "memo-stt")!}
      pipelineCode="memo_sst"
      history="batches"
    />
  );
}
