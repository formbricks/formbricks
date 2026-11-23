import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import { canReadDashboardImageFile, getDashboardImageFileDashboardId } from "./dashboard-image-access";
import { filterReadablePageIds } from "./spicedb-access";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { dashboard: { findFirst: vi.fn() } } }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDashboardViewerRoleEnabled: vi.fn() }));
vi.mock("./spicedb-access", () => ({ filterReadablePageIds: vi.fn() }));

const DASHBOARD = "clda000000000000000000001";
const FILE = `dashboards/${DASHBOARD}/logo.png`;

describe("dashboard image downloads (ENG-7482)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({
      workspace: { organizationId: "org-1" },
      widgets: [{ pageId: "page-1" }, { pageId: "page-2" }],
    } as never);
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
    expect(vi.mocked(prisma.dashboard.findFirst).mock.calls[0][0]).toMatchObject({
      where: { id: DASHBOARD, workspaceId: "ws-1" },
      select: {
        widgets: {
          where: { kind: "image", content: { path: ["fileUrl"], equals: `/storage/ws-1/private/${FILE}` } },
        },
      },
    });
  });

  test("refuses when no page showing it is readable, no block shows it, or the plan lapsed", async () => {
    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set());
    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(false);

    vi.mocked(prisma.dashboard.findFirst).mockResolvedValueOnce({
      workspace: { organizationId: "org-1" },
      widgets: [],
    } as never);
    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(false);

    vi.mocked(filterReadablePageIds).mockResolvedValue(new Set(["page-1"]));
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValueOnce(false);
    await expect(canReadDashboardImageFile("user-1", "ws-1", FILE)).resolves.toBe(false);
  });
});
