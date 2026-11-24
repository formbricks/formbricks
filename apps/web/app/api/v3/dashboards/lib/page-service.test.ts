import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { lockDashboard } from "./dashboard-lock";
import { createPageRow, deletePageRow, updatePageRow } from "./page-service";
import { MAX_DASHBOARD_PAGES } from "./schemas";

/**
 * The decisions the page writes make inside their locked transaction: the page cap, the team-limit
 * permission and eligibility checks, and what each write returns. The real-database behaviour lives in
 * the integration suites.
 */

vi.mock("server-only", () => ({}));
vi.mock("./dashboard-lock", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./dashboard-lock")>()),
  lockDashboard: vi.fn(),
}));

const DASHBOARD_ID = "cldb000000000000000000001";
const WORKSPACE_ID = "clws000000000000000000001";
const PAGE_ID = "clpg000000000000000000001";
const LOCKED_AT = new Date("2026-06-01T12:00:00.000Z");

const pageRow = (teamIds: string[] = [], name = "Page") => ({
  id: PAGE_ID,
  name,
  order: 0,
  teamLimits: teamIds.map((teamId) => ({ teamId })),
});

beforeEach(() => {
  prisma.$transaction.mockImplementation(((fn: (tx: typeof prisma) => unknown) => fn(prisma)) as never);
  vi.mocked(lockDashboard).mockResolvedValue({ updatedAt: LOCKED_AT });
  prisma.dashboard.updateMany.mockResolvedValue({ count: 1 });
});

describe("createPageRow", () => {
  test("is gone when the dashboard cannot be locked", async () => {
    vi.mocked(lockDashboard).mockResolvedValue(null);
    expect(await createPageRow(DASHBOARD_ID, "New")).toEqual({ kind: "gone" });
    expect(prisma.dashboardPage.create).not.toHaveBeenCalled();
  });

  test("refuses a dashboard already at the page cap", async () => {
    prisma.dashboardPage.findMany.mockResolvedValue(
      Array.from({ length: MAX_DASHBOARD_PAGES }, (_, order) => ({ order })) as never
    );
    expect(await createPageRow(DASHBOARD_ID, "New")).toEqual({ kind: "full" });
  });

  test("adds the page after the highest order and moves the dashboard's updatedAt", async () => {
    prisma.dashboardPage.findMany.mockResolvedValue([{ order: 0 }, { order: 7 }] as never);
    prisma.dashboardPage.create.mockResolvedValue(pageRow() as never);

    const result = await createPageRow(DASHBOARD_ID, "New");

    expect(result).toEqual({ kind: "ok", page: pageRow() });
    expect(prisma.dashboardPage.create.mock.calls[0][0].data).toEqual({
      dashboardId: DASHBOARD_ID,
      name: "New",
      order: 8,
    });
    expect(prisma.dashboard.updateMany).toHaveBeenCalled();
  });

  test("is gone when the dashboard disappears before the touch", async () => {
    prisma.dashboardPage.findMany.mockResolvedValue([]);
    prisma.dashboard.updateMany.mockResolvedValue({ count: 0 });
    expect(await createPageRow(DASHBOARD_ID, "New")).toEqual({ kind: "gone" });
    expect(prisma.dashboardPage.create).not.toHaveBeenCalled();
  });
});

describe("updatePageRow", () => {
  const base = { dashboardId: DASHBOARD_ID, workspaceId: WORKSPACE_ID, pageId: PAGE_ID };

  test("is gone for a page of another dashboard", async () => {
    prisma.dashboardPage.findFirst.mockResolvedValue(null);
    expect(await updatePageRow({ ...base, name: "X", canManageAccess: true })).toEqual({ kind: "gone" });
  });

  test("refuses a team limit change by a caller who may not manage access", async () => {
    prisma.dashboardPage.findFirst.mockResolvedValue(pageRow(["team_a"]) as never);
    expect(await updatePageRow({ ...base, teamIds: ["team_b"], canManageAccess: false })).toEqual({
      kind: "accessDenied",
    });
    expect(prisma.dashboardPageTeam.deleteMany).not.toHaveBeenCalled();
  });

  test("lets anyone send the unchanged limit back with a rename", async () => {
    prisma.dashboardPage.findFirst.mockResolvedValue(pageRow(["team_a"], "Old") as never);
    prisma.dashboardPage.update.mockResolvedValue(pageRow(["team_a"], "New") as never);

    const result = await updatePageRow({ ...base, name: "New", teamIds: ["team_a"], canManageAccess: false });

    expect(result).toEqual({
      kind: "ok",
      page: pageRow(["team_a"], "New"),
      previous: { name: "Old", teamIds: ["team_a"] },
    });
    expect(prisma.dashboardPageTeam.deleteMany).not.toHaveBeenCalled();
    expect(prisma.dashboardPage.update.mock.calls[0][0].data).toEqual({ name: "New" });
  });

  test("refuses added teams the page cannot be limited to", async () => {
    prisma.dashboardPage.findFirst.mockResolvedValue(pageRow(["team_a"]) as never);
    prisma.team.findMany.mockResolvedValue([{ id: "team_b" }] as never);

    expect(
      await updatePageRow({ ...base, teamIds: ["team_a", "team_b", "team_c"], canManageAccess: true })
    ).toEqual({ kind: "ineligibleTeams", teamIds: ["team_c"] });
    // Only the added teams are checked.
    expect(prisma.team.findMany.mock.calls[0][0]?.where?.id).toEqual({ in: ["team_b", "team_c"] });
  });

  test("replaces the limit with eligible teams and touches updatedAt without a rename", async () => {
    prisma.dashboardPage.findFirst.mockResolvedValue(pageRow() as never);
    prisma.team.findMany.mockResolvedValue([{ id: "team_a" }] as never);
    prisma.dashboardPage.update.mockResolvedValue(pageRow(["team_a"]) as never);

    const result = await updatePageRow({ ...base, teamIds: ["team_a"], canManageAccess: true });

    expect(result.kind).toBe("ok");
    expect(prisma.dashboardPageTeam.deleteMany).toHaveBeenCalledWith({ where: { pageId: PAGE_ID } });
    expect(prisma.dashboardPageTeam.createMany).toHaveBeenCalledWith({
      data: [{ pageId: PAGE_ID, teamId: "team_a" }],
    });
    expect(prisma.dashboardPage.update.mock.calls[0][0].data).toHaveProperty("updatedAt");
  });

  test("removes the limit when teamIds is null", async () => {
    prisma.dashboardPage.findFirst.mockResolvedValue(pageRow(["team_a"]) as never);
    prisma.dashboardPage.update.mockResolvedValue(pageRow() as never);

    await updatePageRow({ ...base, teamIds: null, canManageAccess: true });

    expect(prisma.dashboardPageTeam.deleteMany).toHaveBeenCalled();
    expect(prisma.dashboardPageTeam.createMany).not.toHaveBeenCalled();
    expect(prisma.team.findMany).not.toHaveBeenCalled();
  });

  test("is gone when the dashboard disappears before the touch", async () => {
    prisma.dashboardPage.findFirst.mockResolvedValue(pageRow() as never);
    prisma.dashboard.updateMany.mockResolvedValue({ count: 0 });
    expect(await updatePageRow({ ...base, name: "X", canManageAccess: true })).toEqual({ kind: "gone" });
    expect(prisma.dashboardPage.update).not.toHaveBeenCalled();
  });
});

describe("deletePageRow", () => {
  test("is gone for a page of another dashboard", async () => {
    prisma.dashboardPage.findFirst.mockResolvedValue(null);
    expect(await deletePageRow(DASHBOARD_ID, PAGE_ID)).toEqual({ kind: "gone" });
  });

  test("refuses the dashboard's only page", async () => {
    prisma.dashboardPage.findFirst.mockResolvedValue({ name: "Page", teamLimits: [], widgets: [] } as never);
    prisma.dashboardPage.count.mockResolvedValue(1);
    expect(await deletePageRow(DASHBOARD_ID, PAGE_ID)).toEqual({ kind: "lastPage" });
    expect(prisma.dashboardPage.delete).not.toHaveBeenCalled();
  });

  test("deletes the page and reports what it removed", async () => {
    prisma.dashboardPage.findFirst.mockResolvedValue({
      name: "Page",
      teamLimits: [{ teamId: "team_a" }],
      widgets: [{ id: "w1" }, { id: "w2" }],
    } as never);
    prisma.dashboardPage.count.mockResolvedValue(2);

    expect(await deletePageRow(DASHBOARD_ID, PAGE_ID)).toEqual({
      kind: "ok",
      removed: { name: "Page", teamIds: ["team_a"], widgetIds: ["w1", "w2"] },
    });
    expect(prisma.dashboardPage.delete).toHaveBeenCalledWith({ where: { id: PAGE_ID } });
    expect(prisma.dashboard.updateMany).toHaveBeenCalled();
  });
});
