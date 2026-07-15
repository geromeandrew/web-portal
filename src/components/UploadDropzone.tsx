import { motion } from "framer-motion";
import { ArrowUpRight, UploadCloud } from "lucide-react";
import { cn } from "../lib/utils";

type UploadDropzoneProps = {
  onFilesSelected: (files: File[]) => void;
  isBusy: boolean;
  dragActive: boolean;
  onDragStateChange: (active: boolean) => void;
  multiple?: boolean;
  eyebrowPrimary?: string;
  eyebrowSecondary?: string;
  title?: string;
  dragTitle?: string;
  description?: string;
  actionLabel?: string;
  busyLabel?: string;
  helpText?: string;
};

export default function UploadDropzone({
  onFilesSelected,
  isBusy,
  dragActive,
  onDragStateChange,
  multiple = true,
  eyebrowPrimary = "Direct to S3",
  eyebrowSecondary = "Private",
  title = "Upload files",
  dragTitle = "Drop to upload",
  description = "Drag and drop or choose files. Progress appears the moment transfer starts.",
  actionLabel = "Choose files",
  busyLabel = "Uploading",
  helpText = "PDF, Office docs, images, ZIP",
}: UploadDropzoneProps) {
  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    onDragStateChange(false);
    if (isBusy) return;
    const dropped = Array.from(event.dataTransfer.files);
    onFilesSelected(dropped);
  };

  return (
    <label
      className={cn(
        "group relative flex min-h-[560px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[36px] border border-white/70 bg-white/75 px-8 py-10 text-center shadow-[0_30px_80px_rgba(15,23,32,0.08)] backdrop-blur-xl transition duration-500",
        dragActive && "border-black/15 bg-white/90 scale-[0.995] shadow-[0_36px_90px_rgba(15,23,32,0.12)]",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        onDragStateChange(true);
      }}
      onDragLeave={() => onDragStateChange(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple={multiple}
        className="hidden"
        disabled={isBusy}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          onFilesSelected(files);
          event.currentTarget.value = "";
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(255,255,255,0.82)_42%,rgba(244,247,251,0.98))]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(112,124,255,0.10),transparent_56%)]" />
      <div className="absolute left-[-8%] top-[14%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95),rgba(255,255,255,0))] blur-2xl" />
      <div className="absolute right-[-6%] bottom-[10%] h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(223,228,255,0.65),rgba(223,228,255,0))] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex max-w-2xl flex-col items-center"
      >
        <motion.div
          animate={{
            y: dragActive ? -2 : 0,
            scale: dragActive ? 1.04 : 1,
          }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-[#111214] text-white shadow-[0_20px_45px_rgba(17,18,20,0.18)]"
        >
          <UploadCloud className="h-10 w-10" />
        </motion.div>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-black/6 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 shadow-[0_10px_25px_rgba(15,23,32,0.04)]">
          {eyebrowPrimary}
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          {eyebrowSecondary}
        </div>

        <h1 className="mt-7 text-balance text-4xl font-semibold tracking-[-0.035em] text-[#111214] md:text-[4.6rem] md:leading-[1.02]">
          {dragActive ? dragTitle : title}
        </h1>

        <p className="mt-5 max-w-xl text-balance text-[15px] leading-7 text-slate-500 md:text-[19px]">
          {description}
        </p>

        <div className="mt-11 flex flex-col items-center gap-4">
          <div className="focus-ring inline-flex min-w-[188px] items-center justify-center gap-2 rounded-full bg-[#111214] px-6 py-3.5 text-sm font-semibold text-white transition duration-300 group-hover:bg-black group-hover:shadow-[0_18px_40px_rgba(17,18,20,0.22)]">
            {isBusy ? busyLabel : actionLabel}
            {!isBusy ? <ArrowUpRight className="h-4 w-4" /> : null}
          </div>

          <p className="text-sm text-slate-400">
            {helpText}
          </p>
        </div>
      </motion.div>
    </label>
  );
}
