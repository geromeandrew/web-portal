import { workspaceUi } from "./WorkspaceShell";

/** Shared header sizing and responsive padding for every workspace history. */
export default function ActivityTableHead({ label }: { label: string }) {
  return (
    <thead className={workspaceUi.tableHead}>
      <tr>
        <th className={workspaceUi.tableHeadingFirst}>{label}</th>
        <th className={workspaceUi.tableHeading}>Uploaded By</th>
        <th className={workspaceUi.tableHeading}>Upload</th>
        <th className={workspaceUi.tableHeading}>Preload</th>
        <th className={workspaceUi.tableHeading}>Postload</th>
        <th className={workspaceUi.tableHeadingActions}>
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
}
