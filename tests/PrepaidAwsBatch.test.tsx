import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PrepaidAwsBatch } from "../src/features/prepaid/components/PrepaidAwsBatch";
import { prepaid, post } from "../src/lib/prepaidApi";

vi.mock("../src/lib/prepaidApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/lib/prepaidApi")>(),
  prepaid: vi.fn(),
  post: vi.fn(),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it("shows the automatic batch and only offers freeze on the eligible side", async () => {
  const reviewed = {
    id:"reviewed-batch",phase:"import",status:"review",deliveryEnabled:true,canReview:true,
    executions:{import:{arn:"import",status:"SUCCEEDED"}},
    layouts:{
      eg:[{layout_number:27,label:"Variance",gross:"0.00",net:"0.00",frozen:false}],
      sg:[{layout_number:27,label:"Variance",gross:"12.34",net:"12.34",frozen:false}],
    },
  };
  vi.mocked(prepaid).mockImplementation(async (path) => path === "/aws-batch"
    ? {batch:reviewed}
    : { rows: [], hasMore: false, pendingJournal: false });
  vi.mocked(post).mockResolvedValue({queued:true});
  const container = document.createElement("div");
  const root = createRoot(container);
  const button = (text: string) => Array.from(container.querySelectorAll("button")).find((element) => element.textContent === text)!;
  try {
    const workspace = {
      selectStage: vi.fn(), switchTab: vi.fn(), variant: "mt" as const,
      page: 0, setPage: vi.fn(), busy: false, perform: vi.fn(),
    };
    await act(async () => root.render(
      <PrepaidAwsBatch workspace={{...workspace, stage: 1, tab: "eg-layout", region: "eg"}} />,
    ));
    expect(button("Start AWS import")).toBeUndefined();
    expect(post).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Ready for review");
    await act(async () => root.render(
      <PrepaidAwsBatch workspace={{...workspace, stage: 2, tab: "sg-layout", region: "sg"}} />,
    ));
    expect(button("Edit").disabled).toBe(true);
    expect(button("Freeze").disabled).toBe(true);
    const blocker = container.querySelectorAll("[id]");
    const notice = Array.from(blocker).find((element) => element.id === button("Freeze").getAttribute("aria-describedby"));
    expect(notice?.textContent).toContain("Gross variance is 12.34.");
    expect(notice?.textContent).toContain("until the gross variance is 0.00.");
    await act(async () => root.render(
      <PrepaidAwsBatch workspace={{...workspace, stage: 2, tab: "eg-layout", region: "eg"}} />,
    ));
    expect(container.textContent).not.toContain("Gross variance is 12.34.");
    expect(button("Freeze").disabled).toBe(false);
    await act(async () => button("Freeze").click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Freeze the EG layout?");
    expect(post).not.toHaveBeenCalled();
    const accept = Array.from(dialog.querySelectorAll("button")).find((item) => item.textContent === "Yes, freeze")!;
    await act(async () => accept.click());
    expect(post).toHaveBeenCalledWith("/aws-batch/action",{action:"eg"});
    const progress = document.querySelector('[role="dialog"]');
    expect(progress?.querySelector("h2")?.textContent).toBe("Freezing EG layout");
    expect(progress?.textContent).toContain("Preparing and delivering the journal.");
  } finally {
    await act(async () => root.unmount());
  }
});

it.each([
  {
    deliveryEnabled: false,
    previous: undefined,
    message: "Freeze and delivery are currently unavailable.",
  },
  {
    deliveryEnabled: true,
    previous: { status: "FAILED" },
    message: "A previous freeze did not complete.",
  },
  {
    deliveryEnabled: true,
    previous: { status: "SUCCEEDED" },
    message: "The layout was frozen. Contact support to verify the journal",
  },
  {
    deliveryEnabled: true,
    previous: { status: "SUCCEEDED", journal: { filename: "txPrepaid_JV_EGSel.txt" } },
    message: "Layout frozen and journal delivered",
  },
])("explains the selected layout restriction $message", async ({ deliveryEnabled, previous, message }) => {
  const batch = {
    id: "b", phase: "eg", status: "review", canReview: true, deliveryEnabled,
    executions: { import: { status: "SUCCEEDED" }, eg: previous },
    layouts: { eg: [{ label: "Variance", gross: "0.00" }] },
  };
  vi.mocked(prepaid).mockImplementation(async (path) => path === "/aws-batch"
    ? { batch }
    : { rows: [], hasMore: false, canEdit: !previous, pendingJournal: false });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PrepaidAwsBatch workspace={{
      stage: 2, tab: "eg-layout", region: "eg", variant: "mt", page: 0, busy: false,
      selectStage: vi.fn(), switchTab: vi.fn(), setPage: vi.fn(), perform: vi.fn(),
    }} />));
    const freeze = [...container.querySelectorAll("button")].find((button) => button.textContent === "Freeze");
    expect(freeze?.disabled).toBe(true);
    const blocker = [...container.querySelectorAll("[id]")].find((element) => element.id === freeze?.getAttribute("aria-describedby"));
    expect(blocker?.textContent).toContain(message);
  } finally {
    await act(async () => root.unmount());
  }
});

it("clears a transient status error when polling recovers", async () => {
  vi.useFakeTimers();
  vi.mocked(prepaid).mockReset()
    .mockRejectedValueOnce(new Error("The request could not be completed. Please try again."))
    .mockResolvedValue({ batch: { id: "b", phase: "import", status: "review", canReview: true } });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PrepaidAwsBatch workspace={{
      stage: 1, tab: "eg-layout", region: "eg", variant: "mt", page: 0, busy: false,
      selectStage: vi.fn(), switchTab: vi.fn(), setPage: vi.fn(), perform: vi.fn(),
    }} />));
    expect(container.textContent).toContain("The request could not be completed");
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(container.textContent).toContain("Ready for review");
    expect(container.textContent).not.toContain("The request could not be completed");
  } finally {
    await act(async () => root.unmount());
    vi.useRealTimers();
  }
});

it("shows a single error when import fails", async () => {
  vi.mocked(prepaid).mockResolvedValue({ batch: {
    id: "failed", phase: "import", status: "failed", canReview: false,
    error: "Processing did not complete. Contact support if the issue persists.",
  } });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PrepaidAwsBatch workspace={{
      stage: 1, tab: "eg-layout", region: "eg", variant: "mt", page: 0, busy: false,
      selectStage: vi.fn(), switchTab: vi.fn(), setPage: vi.fn(), perform: vi.fn(),
    }} />));
    expect(container.textContent).toContain("Processing did not complete.");
    expect(container.textContent).not.toContain("Failed");
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);
  } finally {
    await act(async () => root.unmount());
  }
});
