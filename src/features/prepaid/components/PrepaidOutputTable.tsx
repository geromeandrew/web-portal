import { WorkspaceLoading } from "../../../components/WorkspaceLoading";
import { formatMoney } from "../../../lib/prepaidApi";
export function PrepaidOutputTable({
  rows,
  fields,
  headers,
  loading = false,
  loadingLabel = "Loading data...",
  error = "",
  onRetry,
  renderCell,
  tableClassName = "pp-table",
}: {
  rows: Record<string, unknown>[];
  fields: string[];
  headers: string[];
  loading?: boolean;
  loadingLabel?: string;
  error?: string;
  onRetry?: () => void;
  renderCell?: (row: Record<string, unknown>, field: string) => React.ReactNode;
  tableClassName?: string;
}) {
  return (
    <div className="pp-table-scroll" aria-busy={loading}>
      <table className={tableClassName}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? row.layout_number ?? i)}>
              {fields.map((field, j) => (
                <td key={field} className={j ? "pp-number" : ""}>
                  {renderCell?.(row, field) ?? ([
                    "gross",
                    "amount",
                    "vat_oct",
                    "total_gross",
                    "difference",
                    "amount2",
                  ].includes(field)
                    ? formatMoney(row[field], 2)
                    : ["average_rate", "hits2"].includes(field)
                      ? formatMoney(row[field])
                      : row[field] === null || row[field] === undefined
                        ? ""
                        : String(row[field]))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {loading ? (
        <WorkspaceLoading label={loadingLabel} compact />
      ) : error ? (
        <div className="pp-empty-data" role="alert">
          <p>{error}</p>
          {onRetry && (
            <button className="pp-outline" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      ) : (
        !rows.length && (
          <p className="pp-empty-data">No data available for this revision.</p>
        )
      )}
    </div>
  );
}
