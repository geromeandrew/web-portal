import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function PrepaidActionNotice({
  id,
  tone = "info",
  children,
}: {
  id?: string;
  tone?: "info" | "warning" | "error";
  children: ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlert : tone === "warning" ? TriangleAlert : Info;
  const classes = tone === "info" ? " pp-notice" : tone === "warning" ? " pp-action-warning" : "";
  return (
    <div id={id} className={"pp-error pp-action-notice" + classes} role={tone === "error" ? "alert" : "status"}>
      <Icon size={17} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
