import { billingCyclePipelines } from "../src/lib/billingCyclePipelines";

describe("Billing Cycle pipelines", () => {
  it("contains one unique mapped option for each configured pipeline", () => {
    expect(billingCyclePipelines).toHaveLength(15);
    expect(new Set(billingCyclePipelines.map((pipeline) => pipeline.code)).size).toBe(15);
    expect(billingCyclePipelines).toEqual(expect.arrayContaining([
      { label: "BSS Bill Cycles - Globe", code: "bss_billcycle_glob" },
      { label: "Memo Standard Template", code: "memo_sst" },
      { label: "Prepaid Reclass", code: "prepaid_reclass" },
    ]));
  });
});
