import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Minus, X } from "lucide-react";
export function PrepaidDialog({
  title,
  onClose,
  children,
  wide = false,
  compact = false,
  busy = false,
  dismissible = true,
  closeLabel = "Close dialog",
  minimize = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  compact?: boolean;
  busy?: boolean;
  dismissible?: boolean;
  closeLabel?: string;
  minimize?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (
      ref.current?.querySelector<HTMLElement>(
        "button:not(:disabled),input,select",
      ) ?? ref.current
    )?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (dismissible && !busyRef.current) onClose();
      }
      if (e.key === "Tab") {
        const elements = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href]",
          ) ?? [],
        );
        const first = elements[0],
          last = elements.at(-1);
        if (!first) {
          e.preventDefault();
          ref.current?.focus();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    const appRoot = document.getElementById("root");
    const wasInert = appRoot?.hasAttribute("inert");
    appRoot?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      if (!wasInert) appRoot?.removeAttribute("inert");
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLElement>(".pp-review h2")?.focus();
    };
  }, [onClose, dismissible]);
  return createPortal(
    <div className="pp-overlay">
      <div
        ref={ref}
        className={`pp-dialog${wide ? " pp-dialog-wide" : compact ? " pp-dialog-compact" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={busy}
        tabIndex={-1}
      >
        {dismissible && (
          <button
            type="button"
            className={minimize ? "pp-close pp-minimize" : "pp-close"}
            onClick={onClose}
            aria-label={minimize ? "Minimize" : closeLabel}
            title={minimize ? "Minimize" : undefined}
            disabled={busy}
          >
            {minimize ? <><Minus size={16} aria-hidden="true" /> Minimize</> : <X size={18} />}
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
