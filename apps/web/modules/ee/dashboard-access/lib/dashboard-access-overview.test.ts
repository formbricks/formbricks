import { prisma } from "@/lib/__mocks__/database";
import { describe, expect, test, vi } from "vitest";
import { listMembersWithAttributes } from "@/modules/ee/member-attributes/lib/service";
import {
  VIEW_AS_MEMBER_LIMIT,
  getViewAsMember,
  listDashboardAccessTeams,
  listViewAsMembers,
} from "./dashboard-access-overview";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/ee/member-attributes/lib/service", () => ({ listMembersWithAttributes: vi.fn() }));

const team = (id: string, limitCount: number, limitsThisDashboard: boolean, limited = limitCount > 0) => ({
  id,
  name: id,
  dashboardLimited: limited,
  _count: { teamUsers: 4, dashboardLimits: limitCount },
  dashboardLimits: limitsThisDashboard ? [{ dashboardId: "d1" }] : [],
});

describe("listDashboardAccessTeams", () => {
  test("keeps unlimited teams and teams whose limit names the dashboard, drops the rest", async () => {
    prisma.workspaceTeam.findMany.mockResolvedValue([
      { permission: "read", team: team("all", 0, false) },
      { permission: "manage", team: team("limited_in", 3, true) },
      { permission: "readWrite", team: team("limited_out", 2, false) },
      // Limited with nothing picked: the team opens no dashboard, not all of them.
      { permission: "read", team: team("limited_empty", 0, false, true) },
    ] as never);

    expect(await listDashboardAccessTeams("d1", "ws_1")).toEqual([
      { id: "all", name: "all", permission: "read", limitedDashboardCount: null, memberCount: 4 },
      {
        id: "limited_in",
        name: "limited_in",
        permission: "manage",
        limitedDashboardCount: 3,
        memberCount: 4,
      },
    ]);
    expect(prisma.workspaceTeam.findMany.mock.calls[0][0]?.where).toEqual({ workspaceId: "ws_1" });
  });
});

describe("listViewAsMembers", () => {
  const member = (userId: string, role: "member" | "dashboard_viewer") => ({
    userId,
    name: userId,
    email: `${userId}@example.com`,
    role,
    attributes: [] as { keyId: string; key: string; label: string; values: string[] }[],
  });
  const grant = (userIds: string[], dashboardLimited: boolean, limitsThisDashboard: boolean) => ({
    team: {
      teamUsers: userIds.map((userId) => ({ userId })),
      dashboardLimited,
      dashboardLimits: limitsThisDashboard ? [{ dashboardId: "d1" }] : [],
    },
  });

  test("offers Members and Dashboard Viewers with only the attributes they hold a value for", async () => {
    vi.mocked(listMembersWithAttributes).mockResolvedValue([
      {
        ...member("anna", "member"),
        attributes: [
          { keyId: "k1", key: "country", label: "Country", values: ["Sweden"] },
          { keyId: "k2", key: "city", label: "City", values: [] },
        ],
      },
    ]);
    prisma.workspaceTeam.findMany.mockResolvedValue([grant(["anna"], false, false)] as never);

    expect(await listViewAsMembers("org_1", "d1", "ws_1")).toEqual([
      {
        userId: "anna",
        name: "anna",
        email: "anna@example.com",
        role: "member",
        attributes: [{ label: "Country", values: ["Sweden"] }],
        hasAccess: true,
      },
    ]);
    expect(listMembersWithAttributes).toHaveBeenCalledWith("org_1", {
      limit: VIEW_AS_MEMBER_LIMIT,
      roles: ["member", "dashboard_viewer"],
    });
  });

  test("a Member opens the dashboard through any granted team; a Dashboard Viewer only where the limit allows", async () => {
    vi.mocked(listMembersWithAttributes).mockResolvedValue([
      member("member_limited_team", "member"),
      member("member_no_team", "member"),
      member("viewer_unlimited", "dashboard_viewer"),
      member("viewer_limit_names_it", "dashboard_viewer"),
      member("viewer_limit_elsewhere", "dashboard_viewer"),
      member("viewer_empty_limit", "dashboard_viewer"),
    ]);
    prisma.workspaceTeam.findMany.mockResolvedValue([
      grant(["viewer_unlimited"], false, false),
      grant(["viewer_limit_names_it"], true, true),
      grant(["member_limited_team", "viewer_limit_elsewhere"], true, false),
      grant(["viewer_empty_limit"], true, false),
    ] as never);

    const access = Object.fromEntries(
      (await listViewAsMembers("org_1", "d1", "ws_1")).map(({ userId, hasAccess }) => [userId, hasAccess])
    );
    expect(access).toEqual({
      member_limited_team: true,
      member_no_team: false,
      viewer_unlimited: true,
      viewer_limit_names_it: true,
      viewer_limit_elsewhere: false,
      viewer_empty_limit: false,
    });
  });
});

describe("getViewAsMember", () => {
  test("returns null for someone who is not a member", async () => {
    prisma.membership.findUnique.mockResolvedValue(null);
    expect(await getViewAsMember("org_1", "u1")).toBeNull();
    expect(prisma.membership.findUnique.mock.calls[0][0].where).toEqual({
      userId_organizationId: { userId: "u1", organizationId: "org_1" },
    });
  });

  test("groups the member's values by attribute", async () => {
    prisma.membership.findUnique.mockResolvedValue({
      role: "member",
      user: { name: "Anna", email: "anna@example.com" },
      attributeValues: [
        { value: "Sweden", attributeKey: { id: "k1", label: "Country" } },
        { value: "Malmo", attributeKey: { id: "k2", label: "City" } },
        { value: "Norway", attributeKey: { id: "k1", label: "Country" } },
      ],
    } as never);

    expect(await getViewAsMember("org_1", "u1")).toEqual({
      userId: "u1",
      name: "Anna",
      email: "anna@example.com",
      role: "member",
      attributes: [
        { label: "Country", values: ["Sweden", "Norway"] },
        { label: "City", values: ["Malmo"] },
      ],
    });
  });
});
