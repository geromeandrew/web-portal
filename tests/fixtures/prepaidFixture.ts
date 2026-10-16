import { egLayoutRows, sgLayoutRows } from "../../src/lib/demoData";
import type { Layout, Run, Sources } from "../../src/lib/prepaidApi";
const moneyFields = [
  "gp_mt_gross",
  "hy_mt_gross",
  "gp_bb_gross",
  "total_gross",
  "gp_mt_net",
  "hy_mt_net",
  "gp_bb_net",
  "total_net",
];

export function createPrepaidFixture(screen = "review") {
  const run: Run = {
    id: "fixture-run",
    period: "2026-09",
    snapshots: [{ id: "snapshot", status: "ready" }],
    jobs: [],
    deliveries: [],
  };
  const sources: Sources = {
    valid: true,
    required: [
      { code: "ke24", fileName: "KE24.XLSX" },
      {
        code: "monthly_recharge",
        fileName: "DL_Monthly_Recharge_summary_report.csv",
      },
    ],
    missing: [],
    files:
      screen === "upload"
        ? []
        : [{ id: "file", source_code: "ke24", original_name: "KE24.XLSX" }],
    upstream: null,
  };
  const layouts = {} as Record<"eg" | "sg", Layout>;
  for (const region of ["eg", "sg"] as const)
    layouts[region] = {
      id: region + "-revision",
      version: 1,
      status: screen === "frozen" ? "frozen" : "draft",
      imported: screen !== "upload",
      frozen: screen === "frozen",
      frozen_at: screen === "frozen" ? "2026-09-30T01:00:00Z" : null,
      canFreeze: screen !== "frozen",
      validation: { valid: true, findings: [] },
      rows: (region === "eg" ? egLayoutRows : sgLayoutRows).map((row, i) => ({
        layout_number: i,
        label: row[0],
        editable: [1, 2, 3, 7, 8, 9, 10, 11, 12, 14].includes(i),
        ...Object.fromEntries(
          moneyFields.map((field, j) => [
            field,
            row[j + 1]?.replaceAll(",", "") || null,
          ]),
        ),
      })) as Layout["rows"],
    };
  const calls: { path: string; options?: RequestInit }[] = [];
  const request = async <T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> => {
    const p = path.replace("/workflows/prepaid", "");
    calls.push({ path: p, options });
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    let result: unknown;
    if (p === "/runs") result = { runs: [run] };
    else if (p === "/state") result = { run };
    else if (p === "/workspace")
      result = {
        session: null,
        run: layouts.eg.imported && layouts.sg.imported ? run : null,
        sources,
        error: null,
      };
    else if (p === "/runs/" + run.id) result = run;
    else if (p.endsWith("/sources")) result = sources;
    else if (p.startsWith("/report-history"))
      result = {
        hasMore: false,
        rows: Array.from({ length: 12 }, (_, i) => ({
          run_id: run.id,
          snapshot_id: "snapshot" + i,
          period: run.period,
          uploaded_at: "2026-09-04T02:00:00Z",
          uploaded_by: "Juan dela Cruz",
          revisions: [
            {
              id: layouts.eg.id,
              region: "eg",
              revision: 1,
              exports: [{ id: "export", kind: "replacement" }],
            },
          ],
        })),
      };
    else if (p.endsWith("/exports"))
      result = {
        exports: [
          { id: "export", revision_id: layouts.eg.id, kind: "replacement" },
        ],
      };
    else if (p.endsWith("/reset-workspace") || p === "/workspace/reset") {
      for (const region of ["eg", "sg"] as const) {
        layouts[region].imported = false;
        layouts[region].frozen = false;
        layouts[region].frozen_at = null;
        layouts[region].status = "draft";
        layouts[region].version++;
      }
      sources.files = [];
      result = run;
    } else if (p.includes("/layouts/")) {
      const region = p.includes("/layouts/sg") ? "sg" : "eg",
        layout = layouts[region];
      if (p.includes("allocation-summary"))
        result = {
          rows: [
            {
              type: "HY EG MT",
              gross: "-435612.68",
              tax_rate: "10",
              amount: "-468.11",
              vat_oct: "-46.81",
              total_gross: "-514.92",
              difference: null,
            },
            {
              type: "HY EG MT",
              gross: null,
              tax_rate: "12",
              amount: "-368126.63",
              vat_oct: "-46455.22",
              total_gross: "-433582.05",
              difference: null,
            },
            {
              type: "HY EG MT Difference",
              gross: null,
              tax_rate: "0",
              amount: null,
              vat_oct: null,
              total_gross: "-434096.97",
              difference: "-1515.91",
            },
            { type: "Posting Key 40", amount: "18937936.56" },
            { type: "Posting Key 50", amount: "18937936.56" },
          ],
        };
      else if (p.includes("/allocations"))
        result = {
          revisionId: layout.id,
          rows: [
            {
              profit_center: "P1",
              cost_element: "0000000123",
              revenue_type: "GP_EG_MT",
              tax_rate: "0.12",
              amount: "100",
              denominator: "200",
              allocation: "0.5",
              gross: "112",
              posting_key: 40,
              amount2: "100",
            },
          ],
          total: 1,
          limit: 100,
          offset: 0,
        };
      else if (p.includes("/jv"))
        result = {
          revisionId: layout.id,
          rows: [
            {
              posting_key: 40,
              amount: "100",
              quantity: "1",
              fields: { "Company Code": "GLOB", "Cost Element": "0000000123" },
            },
          ],
          total: 1,
          limit: 100,
          offset: 0,
        };
      else if (p.endsWith("/freeze")) {
        layout.status = "frozen";
        layout.frozen = true;
        layout.canFreeze = false;
        layout.frozen_at = "2026-09-30T01:00:00Z";
        run.deliveries = [
          { id: "delivery", revision_id: layout.id, region, status: "queued" },
        ];
        result = { status: "staged" };
        run.deliveries = [];
      } else if (p.endsWith("/edit")) {
        layout.status = "draft";
        layout.frozen = false;
        layout.frozen_at = null;
        layout.version++;
        result = layout;
      } else if (p.endsWith("/import")) {
        layout.imported = true;
        layout.version++;
        result = layout;
      } else if (options?.method === "PATCH") {
        for (const change of body.changes) {
          const row = layout.rows.find(
            (r) => r.layout_number === change.layoutNumber,
          );
          if (row) Object.assign(row, { [change.field]: change.value });
        }
        layout.version++;
        result = layout;
      } else result = layout;
    } else if (p.endsWith("/process")) {
      run.snapshots = [{ id: "snapshot", status: "ready" }];
      result = { status: "queued" };
    } else result = {};
    return structuredClone(result) as T;
  };
  return { run, sources, layouts, calls, request };
}
