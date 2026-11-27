import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { can } from "@/lib/authorization";
import {
  filterReadableDashboardIds,
  filterReadableDashboardPageIds,
} from "@/lib/authorization/resource-list";
import {
  canManageDashboardAccess,
  canReadDashboard,
  filterReadableDashboardIdsInWorkspace,
  filterReadablePageIds,
} from "./spicedb-access";

vi.mock("@formbricks/database", () => ({
  prisma: {
    dashboard: { findMany: vi.fn() },
    dashboardPage: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authorization/resource-list", () => ({
  filterReadableDashboardIds: vi.fn(),
  filterReadableDashboardPageIds: vi.fn(),
}));

const VIEWER = { type: "user", id: "viewer-1" } as const;
const API_KEY = { type: "apiKey", id: "key-1" } as const;

const page = (id: string, workspaceId: string) => ({ dashboard: { workspaceId }, id });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(can).mockResolvedValue(false);
  vi.mocked(filterReadableDashboardIds).mockResolvedValue(new Set());
  vi.mocked(filterReadableDashboardPageIds).mockResolvedValue(new Set());
  vi.mocked(prisma.dashboard.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.dashboardPage.findMany).mockResolvedValue([] as never);
});

describe("filterReadableDashboardIdsInWorkspace", () => {
  test("keeps every candidate for a subject that reads the workspace, without a bulk check", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(
      filterReadableDashboardIdsInWorkspace(API_KEY, "ws-1", ["dash-1", "dash-2"])
    ).resolves.toEqual(new Set(["dash-1", "dash-2"]));
    expect(can).toHaveBeenCalledWith(API_KEY, "workspace.read", { type: "workspace", id: "ws-1" });
    expect(filterReadableDashboardIds).not.toHaveBeenCalled();
  });

  test("bulk-checks only the candidates for a Dashboard Viewer", async () => {
    vi.mocked(filterReadableDashboardIds).mockResolvedValue(new Set(["dash-2"]));

    await expect(
      filterReadableDashboardIdsInWorkspace(VIEWER, "ws-1", ["dash-1", "dash-2", "dash-1"])
    ).resolves.toEqual(new Set(["dash-2"]));
    expect(filterReadableDashboardIds).toHaveBeenCalledWith(VIEWER, ["dash-1", "dash-2"]);
  });

  test("asks nothing of SpiceDB for no candidates", async () => {
    await expect(filterReadableDashboardIdsInWorkspace(VIEWER, "ws-1", [])).resolves.toEqual(new Set());
    expect(can).not.toHaveBeenCalled();
  });

  test("propagates an operational failure rather than listing nothing", async () => {
    vi.mocked(filterReadableDashboardIds).mockRejectedValue(new Error("authzed_unavailable"));
    await expect(filterReadableDashboardIdsInWorkspace(VIEWER, "ws-1", ["dash-1"])).rejects.toThrow(
      "authzed_unavailable"
    );
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
