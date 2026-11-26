import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { lookupReadableDashboardIds } from "@/lib/authorization/resource-list";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  READABLE_DASHBOARD_CHUNK,
  canReadDashboardImageFile,
  getDashboardImageFileDashboardId,
} from "./dashboard-image-access";
import { filterReadablePageIds } from "./spicedb-access";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: { workspace: { findUnique: vi.fn() }, dashboardWidget: { findMany: vi.fn() } },
}));
vi.mock("@/lib/authorization/resource-list", () => ({ lookupReadableDashboardIds: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDashboardViewerRoleEnabled: vi.fn() }));
vi.mock("./spicedb-access", () => ({ filterReadablePageIds: vi.fn() }));

const DASHBOARD = "clda000000000000000000001";
const FILE = `dashboards/${DASHBOARD}/logo.png`;
const FILE_URL = `/storage/ws-1/private/${FILE}`;

type TWidgetRow = { pageId: string; dashboardId: string; viewerOpen: boolean };

/**
 * A fake of the widget query over `rows`: it applies the dashboard id filter and the page-open filter
 * (`viewerOpen` stands for "unlimited or limited to the viewer's team"), distinct by page, capped by `take`.
 */
const serveWidgets = (rows: TWidgetRow[]) =>
  vi.mocked(prisma.dashboardWidget.findMany).mockImplementation((async (args: {
    where: { dashboardId: { in: string[] } };
    take: number;
  }) => {
    const allowed = new Set(args.where.dashboardId.in);
    const pageIds = [
      ...new Set(rows.filter((r) => r.viewerOpen && allowed.has(r.dashboardId)).map((r) => r.pageId)),
    ].sort();
    return pageIds.slice(0, args.take).map((pageId) => ({ pageId }));
  }) as never);

describe("dashboard image downloads (ENG-7482)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ organizationId: "org-1" } as never);
    vi.mocked(lookupReadableDashboardIds).mockResolvedValue(["dash-1"]);
    serveWidgets([
      { pageId: "page-1", dashboardId: "dash-1", viewerOpen: true },
      { pageId: "page-2", dashboardId: "dash-1", viewerOpen: true },
    ]);
  });

  test("names the dashboard only for dashboards/<id>/<file>", () => {
    expect(getDashboardImageFileDashboardId(FILE)).toBe(DASHBOARD);
    expect(getDashboardImageFileDashboardId(`surveys/${DASHBOARD}/a.png`)).toBeNull();
    expect(getDashboardImageFileDashboardId(`dashboards/${DASHBOARD}/x/a.png`)).toBeNull();
    expect(getDashboardImageFileDashboardId(`dashboards/${DASHBOARD}/`)).toBeNull();
  });

  test("allows when an image block on a readable page shows the exact file", async () => {
    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set(["page-2"]));
    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(true);
    // Blocks on any readable dashboard of the workspace count: a duplicate shows its original's upload.
    expect(vi.mocked(prisma.dashboardWidget.findMany).mock.calls[0][0]).toMatchObject({
      where: {
        kind: "image",
        content: { path: ["fileUrl"], equals: FILE_URL },
        dashboardId: { in: ["dash-1"] },
        dashboard: { workspaceId: "ws-1" },
        page: {
          OR: [
            { teamLimited: false, teamLimits: { none: {} } },
            { teamLimits: { some: { team: { teamUsers: { some: { userId: "user-1" } } } } } },
          ],
        },
      },
      distinct: ["pageId"],
    });
    expect(filterReadablePageIds).toHaveBeenCalledWith({ type: "user", id: "user-1" }, ["page-1", "page-2"]);
  });

  test("refuses when no page showing it is readable, no block shows it, nothing is readable, or the plan lapsed", async () => {
    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set());
    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(false);

    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set(["page-1"]));
    vi.mocked(prisma.dashboardWidget.findMany).mockResolvedValueOnce([] as never);
    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(false);

    vi.mocked(lookupReadableDashboardIds).mockResolvedValueOnce([]);
    vi.mocked(prisma.dashboardWidget.findMany).mockClear();
    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(false);
    expect(prisma.dashboardWidget.findMany).not.toHaveBeenCalled();

    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValueOnce(false);
    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(false);

    await expect(canReadDashboardImageFile("user-1", "ws-1", "surveys/x/a.png")).resolves.toBe(false);
  });

  test("allows past more than 2,000 unreadable references when one is on a page the viewer opens", async () => {
    // 2,500 references on dashboards the viewer cannot read and on pages limited to other teams, then one
    // on a page they open: the unreadable ones never reach the candidate set.
    const rows: TWidgetRow[] = [
      ...Array.from({ length: 2000 }, (_, i) => ({
        pageId: `a-${String(i).padStart(4, "0")}`,
        dashboardId: `hidden-${i}`,
        viewerOpen: true,
      })),
      ...Array.from({ length: 500 }, (_, i) => ({
        pageId: `b-${String(i).padStart(4, "0")}`,
        dashboardId: "dash-1",
        viewerOpen: false,
      })),
      { pageId: "z-readable", dashboardId: "dash-1", viewerOpen: true },
    ];
    serveWidgets(rows);
    vi.mocked(filterReadablePageIds).mockImplementation(
      async (_subject, ids) => new Set(ids.filter((id) => id === "z-readable"))
    );

    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(true);
    expect(prisma.dashboardWidget.findMany).toHaveBeenCalledTimes(1);
    expect(filterReadablePageIds).toHaveBeenCalledWith({ type: "user", id: "user-1" }, ["z-readable"]);
  });

  test("walks the readable dashboards in bounded chunks until one shows the file", async () => {
    const readable = Array.from({ length: READABLE_DASHBOARD_CHUNK * 2 + 1 }, (_, i) => `d${i}`);
    vi.mocked(lookupReadableDashboardIds).mockResolvedValue(readable);
    serveWidgets([{ pageId: "p-last", dashboardId: readable.at(-1)!, viewerOpen: true }]);
    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set(["p-last"]));

    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(true);
    const calls = vi.mocked(prisma.dashboardWidget.findMany).mock.calls;
    expect(calls).toHaveLength(3);
    for (const [args] of calls) {
      expect(
        (args as { where: { dashboardId: { in: string[] } } }).where.dashboardId.in.length
      ).toBeLessThanOrEqual(READABLE_DASHBOARD_CHUNK);
    }
    // SpiceDB is asked only for chunks that hold a candidate page.
    expect(filterReadablePageIds).toHaveBeenCalledTimes(1);
  });

  test("fails closed when SpiceDB has not caught up on the pages the database admits", async () => {
    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set());
    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(false);
  });

  test("propagates a SpiceDB lookup failure instead of allowing", async () => {
    vi.mocked(lookupReadableDashboardIds).mockRejectedValueOnce(new Error("spicedb down"));
    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).rejects.toThrow("spicedb down");
  });
});
