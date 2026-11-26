import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { lookupAuthorizedWorkspaceIds, lookupReadableDashboardIds } from "@/lib/authorization/resource-list";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  listDashboardViewerWorkspaces,
  listDashboardViewerWorkspacesForUser,
} from "./dashboard-viewer-access";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: { findMany: vi.fn() },
    workspace: { findMany: vi.fn() },
    dashboard: { groupBy: vi.fn(async () => []) },
    membership: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/lib/authorization/resource-list", () => ({
  lookupAuthorizedWorkspaceIds: vi.fn(),
  lookupReadableDashboardIds: vi.fn(async () => []),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDashboardViewerRoleEnabled: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listDashboardViewerWorkspacesForUser", () => {
  test("asks SpiceDB once and PostgreSQL once, however many viewer organizations there are", async () => {
    const organizations = Array.from({ length: 25 }, (_unused, index) => ({ id: `org-${index}`, name: "O" }));
    vi.mocked(prisma.organization.findMany).mockResolvedValue(organizations as never);
    vi.mocked(getIsDashboardViewerRoleEnabled).mockImplementation(async (id) => id !== "org-3");
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws-1", "ws-2"]);
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      { id: "ws-1", name: "A", organizationId: "org-1" },
    ] as never);

    await expect(listDashboardViewerWorkspacesForUser("user-1")).resolves.toEqual([
      { id: "ws-1", name: "A", organizationId: "org-1" },
    ]);

    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledTimes(1);
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledWith(
      { type: "user", id: "user-1" },
      "dashboard_read"
    );
    expect(prisma.workspace.findMany).toHaveBeenCalledTimes(1);
    const [query] = vi.mocked(prisma.workspace.findMany).mock.calls[0] as unknown as [
      { where: { organizationId: { in: string[] }; id: { in: string[] } } },
    ];
    // An organization that lost the entitlement contributes nothing.
    expect(query.where.organizationId.in).toHaveLength(24);
    expect(query.where.organizationId.in).not.toContain("org-3");
    expect(query.where.id.in).toEqual(["ws-1", "ws-2"]);
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });

  test("asks nothing more for someone who is a viewer nowhere", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValue([]);

    await expect(listDashboardViewerWorkspacesForUser("user-1")).resolves.toEqual([]);
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });

  test("skips the workspace query when SpiceDB grants no dashboards", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValue([{ id: "org-1", name: "O" }] as never);
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([]);

    await expect(listDashboardViewerWorkspacesForUser("user-1")).resolves.toEqual([]);
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});

describe("listDashboardViewerWorkspaces", () => {
  test("reads the role through the request-cached membership, not a query of its own", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "member" } as never);

    await expect(listDashboardViewerWorkspaces("user-1", "org-1")).resolves.toEqual([]);

    expect(getMembershipByUserIdOrganizationId).toHaveBeenCalledWith("user-1", "org-1");
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
  });

  test("keeps empty workspaces and those with a readable dashboard, grouped in the database", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "dashboard_viewer" } as never);
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws-empty", "ws-open", "ws-closed"]);
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      { id: "ws-closed", name: "Closed" },
      { id: "ws-empty", name: "Empty" },
      { id: "ws-open", name: "Open" },
    ] as never);
    vi.mocked(lookupReadableDashboardIds).mockResolvedValue(["dash-open"]);
    vi.mocked(prisma.dashboard.groupBy).mockImplementation((async ({ where }: { where: { id?: unknown } }) =>
      where.id
        ? [{ workspaceId: "ws-open" }]
        : [{ workspaceId: "ws-open" }, { workspaceId: "ws-closed" }]) as never);

    await expect(listDashboardViewerWorkspaces("user-1", "org-1")).resolves.toEqual([
      { id: "ws-empty", name: "Empty" },
      { id: "ws-open", name: "Open" },
    ]);
    expect(prisma.dashboard.groupBy).toHaveBeenCalledTimes(2);
    expect(prisma.dashboard.groupBy).toHaveBeenLastCalledWith({
      by: ["workspaceId"],
      where: { workspaceId: { in: ["ws-closed", "ws-empty", "ws-open"] }, id: { in: ["dash-open"] } },
    });
  });
});
