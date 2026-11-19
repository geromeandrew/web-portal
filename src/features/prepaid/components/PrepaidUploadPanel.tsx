import { Check, LoaderCircle, Trash2, X } from "lucide-react";
import { workspaceUi } from "../../../components/WorkspaceShell";
import { WorkspaceLoading } from "../../../components/WorkspaceLoading";
import guidelinesIcon from "../../../assets/file-guidelines-icon.svg";
import uploadIcon from "../../../assets/upload-files-icon.svg";
import paperIcon from "../../../assets/paper.svg";
import sheetsIcon from "../../../assets/sheets-icon.svg";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

export function PrepaidUploadPanel({
  workspace,
}: {
  workspace: Pick<
    PrepaidWorkspaceController,
    | "sources"
    | "input"
    | "startUpload"
    | "busy"
    | "loading"
    | "pending"
    | "awsBatchActive"
    | "transfers"
    | "removing"
    | "uploading"
    | "setError"
    | "setRemoval"
    | "setModal"
    | "setTransfers"
  >;
}) {
  const {
    sources,
    input,
    startUpload,
    busy,
    loading,
    pending,
    awsBatchActive,
    transfers,
    removing,
    uploading,
    setError,
    setRemoval,
    setModal,
    setTransfers,
  } = workspace;
  const filesLocked = pending || awsBatchActive;
  const uploadDisabled = busy || loading || filesLocked || !sources;
  return (
    <div className="pp-upload-grid">
      <div className={`pp-upload-card ${workspaceUi.panel} ${workspaceUi.uploadPanel}`}>
        <div className={workspaceUi.guidance}>
          <h2 className={workspaceUi.guidanceTitle}>
            <img className={workspaceUi.guidanceIcon} src={guidelinesIcon} alt="" />
            File Guidelines
          </h2>
          <p className={workspaceUi.guidanceText}>All files must follow the correct file name convention:</p>
          <ul className={`break-words ${workspaceUi.guidanceList}`}>
            {(
              sources?.guidelines ?? sources?.required.map((s) => s.fileName)
            )?.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {!sources && (
            <WorkspaceLoading label="Loading file guidelines..." compact />
          )}
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept=".xlsx,.csv,.txt"
          hidden
          onChange={(e) => {
            Array.from(e.target.files ?? []).forEach(
              (f) => void startUpload(f),
            );
            e.target.value = "";
          }}
        />
        <button
          className={`pp-dropzone ${workspaceUi.dropZone}`}
          disabled={uploadDisabled}
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (uploadDisabled) return;
            Array.from(e.dataTransfer.files).forEach(
              (f) => void startUpload(f),
            );
          }}
        >
          <img className={workspaceUi.uploadIcon} src={uploadIcon} alt="" />
          <strong className={workspaceUi.uploadLabel}>Drop files here</strong>
          <span className={workspaceUi.uploadHint}>or click to browse your computer</span>
        </button>
      </div>
      <div className="pp-upload-list">
        {!sources?.files.length && !transfers.length ? (
          <div className="pp-upload-empty">
            <img src={paperIcon} alt="" />
            <p>Uploaded files will appear here</p>
          </div>
        ) : (
          <>
            {sources?.files
              .filter((f) => !transfers.some((t) => t.code === f.source_code))
              .map((f) => (
                <div
                  className={`pp-file${removing === f.id ? " pp-file-removing" : ""}`}
                  key={f.id}
                  aria-busy={removing === f.id}
                >
                  <img src={sheetsIcon} alt="" />
                  <span>{f.original_name}</span>
                  <span
                    className={
                      removing === f.id ? "pp-removing" : "pp-upload-complete"
                    }
                    role={removing === f.id ? "status" : undefined}
                  >
                    {removing === f.id ? (
                      <LoaderCircle
                        size={15}
                        className="pp-spinner"
                        aria-hidden="true"
                      />
                    ) : (
                      <Check size={15} />
                    )}
                    {removing === f.id ? "Removing…" : "Upload complete"}
                  </span>
                  <button
                    className="pp-icon"
                    disabled={busy || uploading || loading || filesLocked}
                              aria-label={`Remove ${f.original_name}`}
                    title={uploading ? "Finish or cancel uploads before removing a file." : undefined}
                    onClick={() => {
                      setError("");
                      setRemoval(f);
                      setModal("remove");
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            {transfers.map((t) => (
              <div className="pp-file" key={t.code}>
                <img src={sheetsIcon} alt="" />
                <span>
                  {t.file.name}
                  {t.error && <small className="pp-failed">{t.error}</small>}
                </span>
                {t.status === "uploading" ? (
                  <>
                    <progress
                      max={100}
                      value={t.percent}
                      aria-label={`${t.file.name} upload progress`}
                    />
                    <span className="pp-percent">{t.percent}%</span>
                    <button
                      className="pp-link"
                      onClick={() => t.controller.abort()}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="pp-link"
                      disabled={uploadDisabled}
                                  onClick={() => void startUpload(t.file)}
                    >
                      Retry
                    </button>
                    <button
                      className="pp-icon"
                      aria-label={`Dismiss failed upload ${t.file.name}`}
                      onClick={() =>
                        setTransfers((old) =>
                          old.filter(
                            (item) => item.controller !== t.controller,
                          ),
                        )
                      }
                    >
                      <X size={17} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
