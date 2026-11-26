import { WorkspaceLoading } from "../../../components/WorkspaceLoading";
import { PrepaidValidation } from "./PrepaidValidation";
import { formatMoney, moneyFields, ungroupPrepaidAmount } from "../../../lib/prepaidApi";
import { headings } from "../presentation";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

export function PrepaidLayoutTable({
  workspace,
}: {
  workspace: Pick<
    PrepaidWorkspaceController,
    | "editing"
    | "region"
    | "layout"
    | "error"
    | "perform"
    | "refreshWorkspace"
    | "busy"
    | "saving"
    | "changes"
    | "setChanges"
    | "switchTab"
  >;
}) {
  const {
    editing,
    region,
    layout,
    error,
    perform,
    refreshWorkspace,
    busy,
    saving,
    changes,
    setChanges,
    switchTab,
  } = workspace;
  return (
    <>
      <div className="pp-table-scroll" aria-busy={saving}>
        <table
          className={`pp-table pp-layout-table${editing ? " pp-layout-editing" : ""}`}
        >
          <thead>
            <tr>
              {headings.map((h, i) => (
                <th key={h}>
                  {region === "sg" ? h.replaceAll("EG", "SG") : h}
                  {i === 0 && null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!layout && (
              <tr>
                <td colSpan={9}>
                  {error ? (
                    <div role="alert">
                      Could not load the layout.{" "}
                      <button
                        className="pp-outline"
                        onClick={() => void perform(refreshWorkspace)}
                      >
                        Try again
                      </button>
                    </div>
                  ) : (
                    <WorkspaceLoading
                      label={`Loading ${region.toUpperCase()} layout...`}
                    />
                  )}
                </td>
              </tr>
            )}
            {layout?.rows
              .filter((row) => row.layout_number !== 0 || row.label.trim())
              .map((row) => (
                <tr key={row.layout_number}>
                  <td>{row.label}</td>
                  {moneyFields.map((field, i) => {
                    const editable =
                      row.editable &&
                      i < 3 &&
                      (row.editable_fields?.includes(field) ?? true);
                    const key = `${row.layout_number}:${field}`;
                    return (
                      <td className="pp-number" key={field}>
                        {editing && editable ? (
                          <input
                            aria-label={`${row.label} ${field}`}
                            inputMode="decimal"
                            disabled={busy}
                            value={changes[key] ?? formatMoney(row[field])}
                            onBlur={() => setChanges((old) => {
                              if (old[key] === undefined) return old;
                              return { ...old, [key]: formatMoney(ungroupPrepaidAmount(old[key])) };
                            })}
                            onChange={(e) =>
                              setChanges((old) => {
                                const next = { ...old };
                                if (ungroupPrepaidAmount(e.target.value) === (row[field] ?? ""))
                                  delete next[key];
                                else next[key] = e.target.value;
                                return next;
                              })
                            }
                          />
                        ) : (
                          formatMoney(row[field], 2)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
        {layout && !layout.rows.length && (
          <p className="pp-empty-data">
            Import processed sources to review the layout.
          </p>
        )}
      </div>
      {layout?.imported &&
        (!layout.validation?.valid ||
          Boolean(layout.validation?.findings.length)) && (
          <PrepaidValidation
            validation={layout.validation}
            frozen={layout.frozen}
            onReview={(variant) => switchTab("allocation", region, variant)}
          />
        )}
    </>
  );
}
