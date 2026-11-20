import { PrepaidOutputTable as OutputTable } from "./PrepaidOutputTable";
import type { PrepaidWorkspaceController } from "../hooks/usePrepaidWorkspace";

export function PrepaidAllocationBreakdown({
  workspace,
  hasMore,
}: {
  workspace: Pick<
    PrepaidWorkspaceController,
    | "region"
    | "variant"
    | "outputLoading"
    | "outputError"
    | "retryOutput"
    | "page"
    | "setPage"
  > & { output?: { rows: Record<string, unknown>[]; total?: number } | null };
  hasMore?: boolean;
}) {
  const {
    region,
    variant,
    outputLoading,
    outputError,
    retryOutput,
    output,
    page,
    setPage,
  } = workspace;
  return (
    <>
      <div className="pp-breakdown">
        <h2>
          {region.toUpperCase()} {variant.toUpperCase()} Allocation breakdown
        </h2>
        <OutputTable
          loading={outputLoading}
          loadingLabel="Loading allocation breakdown..."
          error={outputError}
          onRetry={retryOutput}
          rows={output?.rows ?? []}
          fields={[
            "profit_center",
            "cost_element",
            "sub_product",
            "revenue_type",
            "tax_rate",
            "average_rate",
            "uom",
            "amount",
            "denominator",
            "allocation",
            "gross",
            "posting_key",
            "amount2",
            "hits2",
          ]}
          headers={[
            "PROFIT CENTER",
            "COST ELEMENT",
            "SUB-PRODUCT",
            "REVENUE TYPE",
            "TAX RATE",
            "AVERAGE RATE",
            "UNIT",
            "AMOUNT",
            "DENOMINATOR",
            "ALLOCATION",
            "GROSS",
            "POSTING KEY",
            "FINAL AMOUNT",
            "QUANTITY",
          ]}
        />
        <div className="pp-pagination">
          <button disabled={outputLoading || page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button
            disabled={outputLoading || !(hasMore ?? ((page + 1) * 100 < (output?.total ?? 0)))}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
