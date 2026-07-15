import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CloudUpload, KeyRound, type LucideIcon } from "lucide-react";
import ShellHeader from "../components/ShellHeader";
import UploadDropzone from "../components/UploadDropzone";
import UploadQueue from "../components/UploadQueue";
import {
  requestPresignedUploads,
  uploadFileThroughLambda,
  uploadFileWithProgress,
  validateLambdaFile,
  validateLocalFiles,
} from "../lib/uploadClient";
import { applyPresignResponse, toQueueItems, updateQueueItem, type UploadQueueItem } from "../lib/uploadState";

type UploadMode = "direct" | "lambda";

const uploadModes: Array<{
  id: UploadMode;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "lambda",
    label: "Lambda Upload",
    description: "Small files through Lambda",
    icon: KeyRound,
  },
  {
    id: "direct",
    label: "Direct S3",
    description: "Presigned browser transfer",
    icon: CloudUpload,
  },
];

export default function HomeRoute() {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [lambdaItems, setLambdaItems] = useState<UploadQueueItem[]>([]);
  const [uploadMode, setUploadMode] = useState<UploadMode>("lambda");
  const [directDragActive, setDirectDragActive] = useState(false);
  const [lambdaDragActive, setLambdaDragActive] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const isBusy = items.some((item) => item.status === "requesting" || item.status === "uploading");
  const isLambdaBusy = lambdaItems.some(
    (item) => item.status === "requesting" || item.status === "uploading",
  );

  const summary = useMemo(() => {
    const currentItems = uploadMode === "direct" ? items : lambdaItems;
    const total = currentItems.length;
    const uploaded = currentItems.filter((item) => item.status === "success").length;
    const failed = currentItems.filter((item) => item.status === "error" || item.status === "rejected").length;
    return { total, uploaded, failed };
  }, [items, lambdaItems, uploadMode]);

  const runUploadFlow = async (pending: UploadQueueItem[]) => {
    setItems((current) =>
      current.map((item) =>
        pending.some((candidate) => candidate.id === item.id)
          ? { ...item, status: "requesting", progress: 4, message: undefined }
          : item,
      ),
    );

    try {
      const presigned = await requestPresignedUploads(pending);
      const hydrated = applyPresignResponse(pending, presigned);

      setItems((current) =>
        current.map((item) => hydrated.find((candidate) => candidate.id === item.id) ?? item),
      );

      for (const candidate of hydrated) {
        if (candidate.status !== "ready") {
          continue;
        }

        setItems((current) =>
          updateQueueItem(current, candidate.id, {
            status: "uploading",
            progress: 12,
          }),
        );

        try {
          await uploadFileWithProgress(candidate, (progress) => {
            setItems((current) =>
              updateQueueItem(current, candidate.id, {
                status: "uploading",
                progress,
              }),
            );
          });

          setItems((current) =>
            updateQueueItem(current, candidate.id, {
              status: "success",
              progress: 100,
              message: "Transfer complete.",
            }),
          );
        } catch (error) {
          setItems((current) =>
            updateQueueItem(current, candidate.id, {
              status: "error",
              message: error instanceof Error ? error.message : "Upload failed.",
            }),
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start upload.";
      setBanner(message);
      setItems((current) =>
        current.map((item) =>
          pending.some((candidate) => candidate.id === item.id)
            ? { ...item, status: "error", progress: 0, message }
            : item,
        ),
      );
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    if (uploadMode !== "direct") {
      await handleLambdaFileSelected(files);
      return;
    }

    setBanner(null);

    const { accepted, rejected } = validateLocalFiles(files);
    const nextItems = toQueueItems(accepted);
    const rejectedItems = rejected.map<UploadQueueItem>((entry) => ({
      id: crypto.randomUUID(),
      file: new File([], entry.name),
      status: "rejected",
      progress: 0,
      message: entry.reason,
    }));

    setItems((current) => [...nextItems, ...rejectedItems, ...current]);

    if (rejected.length > 0) {
      setBanner(`${rejected.length} file(s) were rejected before upload.`);
    }

    if (nextItems.length > 0) {
      await runUploadFlow(nextItems);
    }
  };

  const runLambdaUploadFlow = async (item: UploadQueueItem) => {
    setLambdaItems((current) =>
      updateQueueItem(current, item.id, {
        status: "uploading",
        progress: 6,
        message: undefined,
      }),
    );

    try {
      const response = await uploadFileThroughLambda(item, (progress) => {
        setLambdaItems((current) =>
          updateQueueItem(current, item.id, {
            status: "uploading",
            progress,
          }),
        );
      });

      setLambdaItems((current) =>
        updateQueueItem(current, item.id, {
          status: "success",
          progress: 100,
          objectKey: response.upload.objectKey,
          message: "Transfer complete.",
        }),
      );
    } catch (error) {
      setLambdaItems((current) =>
        updateQueueItem(current, item.id, {
          status: "error",
          progress: 0,
          message: error instanceof Error ? error.message : "Lambda upload failed.",
        }),
      );
    }
  };

  const handleLambdaFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    if (uploadMode !== "lambda") {
      await handleFilesSelected(files);
      return;
    }

    setBanner(null);

    const file = files[0];
    if (files.length > 1) {
      setBanner("Lambda upload accepts one file at a time. Only the first file was queued.");
    }

    const rejection = validateLambdaFile(file);
    if (rejection) {
      const rejectedItem: UploadQueueItem = {
        id: crypto.randomUUID(),
        file,
        status: "rejected",
        progress: 0,
        message: rejection,
      };
      setLambdaItems((current) => [rejectedItem, ...current]);
      return;
    }

    const [item] = toQueueItems([file]);
    setLambdaItems((current) => [item, ...current]);
    await runLambdaUploadFlow(item);
  };

  const handleRemove = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const handleRetry = async (id: string) => {
    const candidate = items.find((item) => item.id === id);
    if (!candidate) return;

    const refreshed = {
      ...candidate,
      status: "queued" as const,
      progress: 0,
      message: undefined,
      objectKey: undefined,
      uploadUrl: undefined,
      headers: undefined,
      expiresAt: undefined,
    };

    setItems((current) => current.map((item) => (item.id === id ? refreshed : item)));
    await runUploadFlow([refreshed]);
  };

  const handleLambdaRemove = (id: string) => {
    setLambdaItems((current) => current.filter((item) => item.id !== id));
  };

  const handleLambdaRetry = async (id: string) => {
    const candidate = lambdaItems.find((item) => item.id === id);
    if (!candidate) return;

    const rejection = validateLambdaFile(candidate.file);
    const refreshed: UploadQueueItem = {
      ...candidate,
      status: rejection ? "rejected" : "queued",
      progress: 0,
      message: rejection ?? undefined,
      objectKey: undefined,
      uploadUrl: undefined,
      headers: undefined,
      expiresAt: undefined,
    };

    setLambdaItems((current) => current.map((item) => (item.id === id ? refreshed : item)));

    if (!rejection) {
      await runLambdaUploadFlow(refreshed);
    }
  };

  const activeItems = uploadMode === "direct" ? items : lambdaItems;

  return (
    <div className="min-h-screen pb-16">
      <ShellHeader />

      <main className="mx-auto max-w-5xl px-6 pt-10 md:pt-14">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="space-y-6"
        >
          <div className="grid gap-3 rounded-[28px] border border-white/70 bg-white/72 p-2 shadow-[0_18px_50px_rgba(15,23,32,0.05)] backdrop-blur-xl md:grid-cols-2">
            {uploadModes.map((mode) => {
              const ModeIcon = mode.icon;
              const isActive = uploadMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  className={`focus-ring flex items-center gap-3 rounded-[22px] px-4 py-3 text-left transition ${
                    isActive
                      ? "bg-[#111214] text-white shadow-[0_18px_35px_rgba(17,18,20,0.16)]"
                      : "text-slate-500 hover:bg-white/80 hover:text-slate-900"
                  }`}
                  onClick={() => {
                    setUploadMode(mode.id);
                    setBanner(null);
                  }}
                  aria-pressed={isActive}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isActive ? "bg-white/12" : "bg-slate-100"
                    }`}
                  >
                    <ModeIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{mode.label}</span>
                    <span className={`block truncate text-xs ${isActive ? "text-white/68" : "text-slate-400"}`}>
                      {mode.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {uploadMode === "direct" ? (
              <motion.div
                key="direct-upload"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                <UploadDropzone
                  isBusy={isBusy}
                  dragActive={directDragActive}
                  onDragStateChange={setDirectDragActive}
                  onFilesSelected={handleFilesSelected}
                />
              </motion.div>
            ) : (
              <motion.div
                key="lambda-upload"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                <UploadDropzone
                  isBusy={isLambdaBusy}
                  dragActive={lambdaDragActive}
                  onDragStateChange={setLambdaDragActive}
                  onFilesSelected={handleLambdaFileSelected}
                  multiple={false}
                  eyebrowPrimary="Lambda"
                  eyebrowSecondary="Private S3"
                  title="Upload via Lambda"
                  dragTitle="Drop one file"
                  description="Choose one small file. Lambda receives the file and writes it to the private bucket."
                  actionLabel="Choose file"
                  helpText="Small files only, up to about 4 MB"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <AnimatePresence>
          {banner ? (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>{banner}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {(summary.total > 0 || banner) && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
            className="mt-6"
          >
            <UploadQueue
              items={activeItems}
              onRemove={uploadMode === "direct" ? handleRemove : handleLambdaRemove}
              onRetry={uploadMode === "direct" ? handleRetry : handleLambdaRetry}
            />
          </motion.div>
        )}
      </main>
    </div>
  );
}
