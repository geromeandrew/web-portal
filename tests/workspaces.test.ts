import { resolveWorkspacePipelineCode, workspaces, workspaceHref } from "../src/lib/workspaces";

describe("workspace registry", () => {
  it("provides the six dashboard workspaces and their destinations", () => {
    expect(workspaces).toHaveLength(6);
    expect(workspaces.map((workspace) => workspace.title)).toEqual([
      "BSS Bill Cycle - Globe",
      "BSS Bill Cycle - Innove",
      "BSS Bill Cycle - Bayan",
      "APRM - Content",
      "Memo STT",
      "Prepaid Re-Class",
    ]);
    expect(workspaceHref(workspaces[0])).toBe("/processing-pipelines?workspace=bss-bill-cycle-globe");
    expect(workspaceHref(workspaces[3])).toBe("/aprm/content");
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
