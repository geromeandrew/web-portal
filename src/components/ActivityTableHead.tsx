import { workspaceUi } from "./WorkspaceShell";

/** Shared header sizing and responsive padding for every workspace history. */
export default function ActivityTableHead({ label }: { label: string }) {
  return (
    <thead className={workspaceUi.tableHead}>
      <tr>
        <th scope="col" className={workspaceUi.tableHeadingFirst}>
          {label}
        </th>
        <th scope="col" className={workspaceUi.tableHeading}>
          Uploaded By
        </th>
        <th scope="col" className={workspaceUi.tableHeading}>
          Upload
        </th>
        <th scope="col" className={workspaceUi.tableHeadingActions}>
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
}
