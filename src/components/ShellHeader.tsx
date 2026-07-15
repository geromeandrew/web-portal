import { ArrowUpCircle } from "lucide-react";

export default function ShellHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/70 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111214] text-white">
            <ArrowUpCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Web Portal
            </p>
            <p className="text-sm font-medium text-slate-900">Upload</p>
          </div>
        </div>

        <p className="hidden text-sm text-slate-500 md:block">Private transfer</p>
      </div>
    </header>
  );
}
