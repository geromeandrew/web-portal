import {
  allowedWorkspaces,
  dashboardWorkspaceHref,
  dashboardWorkspaces,
  resolveWorkspacePipelineCode,
  workspaces,
  workspaceHref,
} from "../src/lib/workspaces";

describe("workspace registry", () => {
  it("lists supported workspaces and preserves the prepaid dashboard route", () => {
    expect(workspaces).toHaveLength(12);
    expect(workspaces.map((workspace) => workspace.title)).toEqual(
      expect.arrayContaining([
        "BSS EOM - Globe",
        "BSS EOM - Innove",
        "BSS EOM - Bayan",
        "APRM Voice - Accrual",
        "APRM Voice - Delta",
        "ISMS IBOB Actualization",
        "ISMS IOT Discount",
        "Prepaid Re-Class",
      ]),
    );
    expect(workspaceHref(workspaces[0])).toBe(
      "/processing-pipelines?workspace=bss-bill-cycle-globe",
    );
    expect(
      workspaceHref(
        workspaces.find((workspace) => workspace.id === "prepaid-re-class")!,
      ),
    ).toBe("/prepaid/file-upload");
    expect(dashboardWorkspaces).toHaveLength(5);
    expect(dashboardWorkspaceHref(dashboardWorkspaces.at(-1)!)).toBe(
      "/prepaid/file-upload",
    );
  });

  it("grants no implicit workspace access and hides unsupported modules even when assigned", () => {
    expect(allowedWorkspaces([])).toEqual([]);
    expect(
      allowedWorkspaces(["aprm_content", "iccbs_inov", "iccbs_bayn", "north"]),
    ).toEqual([]);
    expect(
      allowedWorkspaces(["bss_eom_glob"]).map((workspace) => workspace.id),
    ).toEqual(["bss-eom-globe"]);
    expect(
      workspaces.some((workspace) =>
        ["aprm-content", "iccbs-innove", "iccbs-bayan", "north"].includes(
          workspace.id,
        ),
      ),
    ).toBe(false);
  });

  it("resolves a BSS workspace from a normalized catalog label", () => {
    const code = resolveWorkspacePipelineCode("bss-bill-cycle-globe", [
      { code: "bayan", label: "BSS Bill Cycle - Bayan" },
      { code: "globe", label: "BSS / Bill Cycle: Globe" },
    ]);

    expect(code).toBe("globe");
  });

  it("does not select an unrelated pipeline", () => {
    expect(
      resolveWorkspacePipelineCode("bss-bill-cycle-innove", [
        { code: "globe", label: "BSS Bill Cycle - Globe" },
      ]),
    ).toBeNull();
  });
});
