import { dashboardWorkspaceHref, dashboardWorkspaces, resolveWorkspacePipelineCode, workspaces, workspaceHref } from "../src/lib/workspaces";

describe("workspace registry", () => {
  it("provides a navigation workspace for every configured pipeline without changing dashboard routes", () => {
    expect(workspaces).toHaveLength(16);
    expect(workspaces.map((workspace) => workspace.title)).toEqual(expect.arrayContaining([
      "BSS EOM - Globe", "BSS EOM - Innove", "BSS EOM - Bayan",
      "ICCBS - Innove", "ICCBS - Bayan", "APRM Voice - Accrual", "APRM Voice - Delta",
      "ISMS IBOB Actualization", "ISMS IOT Discount", "North", "Prepaid Re-Class",
    ]));
    expect(workspaceHref(workspaces[0])).toBe("/processing-pipelines?workspace=bss-bill-cycle-globe");
    expect(workspaceHref(workspaces.find((workspace) => workspace.id === "aprm-content")!)).toBe("/aprm/content");
    expect(workspaceHref(workspaces.find((workspace) => workspace.id === "prepaid-re-class")!)).toBe("/processing-pipelines?workspace=prepaid-re-class");
    expect(dashboardWorkspaces).toHaveLength(6);
    expect(dashboardWorkspaceHref(dashboardWorkspaces.at(-1)!)).toBe("/prepaid/file-upload");
  });

  it("resolves a BSS workspace from a normalized catalog label", () => {
    const code = resolveWorkspacePipelineCode("bss-bill-cycle-globe", [
      { code: "bayan", label: "BSS Bill Cycle - Bayan" },
      { code: "globe", label: "BSS / Bill Cycle: Globe" },
    ]);

    expect(code).toBe("globe");
  });

  it("does not select an unrelated pipeline", () => {
    expect(resolveWorkspacePipelineCode("bss-bill-cycle-innove", [
      { code: "globe", label: "BSS Bill Cycle - Globe" },
    ])).toBeNull();
  });
});
