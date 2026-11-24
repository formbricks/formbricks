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

const team = (id: string, limitCount: number, limitsThisDashboard: boolean) => ({
  id,
  name: id,
  _count: { teamUsers: 4, dashboardLimits: limitCount },
  dashboardLimits: limitsThisDashboard ? [{ dashboardId: "d1" }] : [],
});

describe("listDashboardAccessTeams", () => {
  test("keeps unlimited teams and teams whose limit names the dashboard, drops the rest", async () => {
    prisma.workspaceTeam.findMany.mockResolvedValue([
      { permission: "read", team: team("all", 0, false) },
      { permission: "manage", team: team("limited_in", 3, true) },
      { permission: "readWrite", team: team("limited_out", 2, false) },
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
  test("offers members with only the attributes they hold a value for", async () => {
    vi.mocked(listMembersWithAttributes).mockResolvedValue([
      {
        userId: "u1",
        name: "Anna",
        email: "anna@example.com",
        role: "member",
        attributes: [
          { keyId: "k1", key: "country", label: "Country", values: ["Sweden"] },
          { keyId: "k2", key: "city", label: "City", values: [] },
        ],
      },
    ]);

    expect(await listViewAsMembers("org_1")).toEqual([
      {
        userId: "u1",
        name: "Anna",
        email: "anna@example.com",
        role: "member",
        attributes: [{ label: "Country", values: ["Sweden"] }],
      },
    ]);
    expect(listMembersWithAttributes).toHaveBeenCalledWith("org_1", { limit: VIEW_AS_MEMBER_LIMIT });
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
