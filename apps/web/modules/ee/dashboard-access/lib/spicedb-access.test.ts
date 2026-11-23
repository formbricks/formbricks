import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { can } from "@/lib/authorization";
import {
  filterReadableDashboardPageIds,
  lookupReadableDashboardIds,
} from "@/lib/authorization/resource-list";
import {
  canManageDashboardAccess,
  canReadDashboard,
  filterReadablePageIds,
  listReadableDashboardIds,
} from "./spicedb-access";

vi.mock("@formbricks/database", () => ({
  prisma: {
    dashboard: { findMany: vi.fn() },
    dashboardPage: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authorization/resource-list", () => ({
  filterReadableDashboardPageIds: vi.fn(),
  lookupReadableDashboardIds: vi.fn(),
}));

const VIEWER = { type: "user", id: "viewer-1" } as const;
const API_KEY = { type: "apiKey", id: "key-1" } as const;

const page = (id: string, workspaceId: string) => ({ dashboard: { workspaceId }, id });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(can).mockResolvedValue(false);
  vi.mocked(lookupReadableDashboardIds).mockResolvedValue([]);
  vi.mocked(filterReadableDashboardPageIds).mockResolvedValue(new Set());
  vi.mocked(prisma.dashboard.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.dashboardPage.findMany).mockResolvedValue([] as never);
});

describe("listReadableDashboardIds", () => {
  test("lists every dashboard of a workspace the subject reads, without a graph lookup", async () => {
    vi.mocked(prisma.dashboard.findMany).mockResolvedValue([{ id: "dash-1" }, { id: "dash-2" }] as never);
    vi.mocked(can).mockResolvedValue(true);

    await expect(listReadableDashboardIds(API_KEY, "ws-1")).resolves.toEqual(new Set(["dash-1", "dash-2"]));

    expect(prisma.dashboard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws-1" } })
    );
    expect(can).toHaveBeenCalledWith(API_KEY, "workspace.read", { type: "workspace", id: "ws-1" });
    expect(lookupReadableDashboardIds).not.toHaveBeenCalled();
  });

  // A Dashboard Viewer's team dashboard limits live in SpiceDB; PostgreSQL bounds the answer to this
  // workspace's rows, so another workspace's dashboard, or one whose row is gone, never comes back.
  test("intersects a Dashboard Viewer's lookup with the workspace's dashboards", async () => {
    vi.mocked(prisma.dashboard.findMany).mockResolvedValue([{ id: "dash-1" }, { id: "dash-2" }] as never);
    vi.mocked(lookupReadableDashboardIds).mockResolvedValue([
      "dash-2",
      "dash-other-workspace",
      "dash-deleted",
    ]);

    await expect(listReadableDashboardIds(VIEWER, "ws-1")).resolves.toEqual(new Set(["dash-2"]));
    expect(lookupReadableDashboardIds).toHaveBeenCalledWith(VIEWER);
  });

  test("asks nothing of SpiceDB for a workspace without dashboards", async () => {
    await expect(listReadableDashboardIds(VIEWER, "ws-1")).resolves.toEqual(new Set());
    expect(can).not.toHaveBeenCalled();
    expect(lookupReadableDashboardIds).not.toHaveBeenCalled();
  });

  test("propagates an operational failure rather than listing nothing", async () => {
    vi.mocked(prisma.dashboard.findMany).mockResolvedValue([{ id: "dash-1" }] as never);
    vi.mocked(lookupReadableDashboardIds).mockRejectedValue(new Error("authzed_unavailable"));

    await expect(listReadableDashboardIds(VIEWER, "ws-1")).rejects.toThrow("authzed_unavailable");
  });
});

describe("filterReadablePageIds", () => {
  test("passes the pages of a workspace the subject reads and bulk-checks only the rest", async () => {
    vi.mocked(prisma.dashboardPage.findMany).mockResolvedValue([
      page("page-read-ws", "ws-read"),
      page("page-limited", "ws-viewer"),
      page("page-open", "ws-viewer"),
    ] as never);
    vi.mocked(can).mockImplementation(
      (async (_subject: unknown, _action: unknown, resource: { id: string }) =>
        resource.id === "ws-read") as never
    );
    vi.mocked(filterReadableDashboardPageIds).mockResolvedValue(new Set(["page-open"]));

    await expect(
      filterReadablePageIds(VIEWER, ["page-read-ws", "page-limited", "page-open", "page-open", "page-gone"])
    ).resolves.toEqual(new Set(["page-read-ws", "page-open"]));

    expect(prisma.dashboardPage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["page-read-ws", "page-limited", "page-open", "page-gone"] } },
      })
    );
    // One workspace check per distinct workspace, never one per page.
    expect(can).toHaveBeenCalledTimes(2);
    expect(filterReadableDashboardPageIds).toHaveBeenCalledWith(VIEWER, ["page-limited", "page-open"]);
  });

  test("never returns a page PostgreSQL does not hold", async () => {
    vi.mocked(filterReadableDashboardPageIds).mockResolvedValue(new Set());

    await expect(filterReadablePageIds(VIEWER, ["page-gone"])).resolves.toEqual(new Set());
  });

  test("answers an empty list without a query", async () => {
    await expect(filterReadablePageIds(VIEWER, [])).resolves.toEqual(new Set());
    expect(prisma.dashboardPage.findMany).not.toHaveBeenCalled();
  });
});

describe("single dashboard decisions", () => {
  test("canReadDashboard asks dashboard.read of the dashboard", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(canReadDashboard(VIEWER, "dash-1")).resolves.toBe(true);
    expect(can).toHaveBeenCalledWith(VIEWER, "dashboard.read", { type: "dashboard", id: "dash-1" });
  });

  test("canManageDashboardAccess asks dashboard.manage_access for the user", async () => {
    await expect(canManageDashboardAccess("user-1", "dash-1")).resolves.toBe(false);
    expect(can).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "dashboard.manage_access", {
      type: "dashboard",
      id: "dash-1",
    });
  });
});
