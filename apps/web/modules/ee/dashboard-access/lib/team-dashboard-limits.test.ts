import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Prisma } from "@formbricks/database/prisma";
import {
  TeamDashboardLimitsInvalidError,
  deleteTeamDashboardLimitsInWorkspaces,
  getTeamDashboardLimits,
  getTeamOrganizationId,
  listTeamDashboardOptions,
  replaceTeamDashboardLimits,
} from "./team-dashboard-limits";

vi.mock("server-only", () => ({}));

const ORG = "org_1";
const TEAM = "team_1";

beforeEach(() => {
  prisma.$transaction.mockImplementation(((fn: (tx: typeof prisma) => unknown) => fn(prisma)) as never);
});

describe("reads", () => {
  test("getTeamOrganizationId returns the team's organization, or null", async () => {
    prisma.team.findUnique.mockResolvedValueOnce({ organizationId: ORG } as never);
    expect(await getTeamOrganizationId(TEAM)).toBe(ORG);
    prisma.team.findUnique.mockResolvedValueOnce(null);
    expect(await getTeamOrganizationId(TEAM)).toBeNull();
  });

  test("getTeamDashboardLimits returns the limit, or null for a team of another organization", async () => {
    prisma.team.findFirst.mockResolvedValueOnce({
      id: TEAM,
      dashboardLimited: true,
      dashboardLimits: [{ dashboardId: "d1" }],
    } as never);
    expect(await getTeamDashboardLimits(ORG, TEAM)).toEqual({
      teamId: TEAM,
      limited: true,
      dashboardIds: ["d1"],
    });
    expect(prisma.team.findFirst.mock.calls[0][0]?.where).toEqual({ id: TEAM, organizationId: ORG });

    prisma.team.findFirst.mockResolvedValueOnce(null);
    expect(await getTeamDashboardLimits(ORG, TEAM)).toBeNull();
  });

  test("listTeamDashboardOptions lists the dashboards of the team's granted workspaces", async () => {
    prisma.dashboard.findMany.mockResolvedValue([
      { id: "d1", name: "Board", workspace: { id: "ws_1", name: "Web" } },
    ] as never);

    expect(await listTeamDashboardOptions(ORG, TEAM)).toEqual([
      { id: "d1", name: "Board", workspaceId: "ws_1", workspaceName: "Web" },
    ]);
    expect(prisma.dashboard.findMany.mock.calls[0][0]?.where).toEqual({
      workspace: { organizationId: ORG, workspaceTeams: { some: { teamId: TEAM } } },
    });
  });
});

describe("replaceTeamDashboardLimits", () => {
  test("returns null for a team of another organization", async () => {
    prisma.team.findFirst.mockResolvedValue(null);
    expect(await replaceTeamDashboardLimits(ORG, TEAM, ["d1"])).toBeNull();
    expect(prisma.teamDashboard.createMany).not.toHaveBeenCalled();
  });

  test("refuses dashboards outside the team's workspaces, naming them", async () => {
    prisma.team.findFirst.mockResolvedValue({ dashboardLimited: false, dashboardLimits: [] } as never);
    prisma.dashboard.findMany.mockResolvedValue([{ id: "d1" }] as never);

    const error = await replaceTeamDashboardLimits(ORG, TEAM, ["d1", "d_other"]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TeamDashboardLimitsInvalidError);
    expect((error as TeamDashboardLimitsInvalidError).dashboardIds).toEqual(["d_other"]);
    expect(prisma.dashboard.findMany.mock.calls[0][0]?.where).toEqual({
      id: { in: ["d1", "d_other"] },
      workspace: { organizationId: ORG, workspaceTeams: { some: { teamId: TEAM } } },
    });
    expect(prisma.teamDashboard.createMany).not.toHaveBeenCalled();
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  test("sets dashboardLimited for non-empty ids and writes only the difference", async () => {
    prisma.team.findFirst.mockResolvedValue({
      dashboardLimited: false,
      dashboardLimits: [{ dashboardId: "d1" }, { dashboardId: "d2" }],
    } as never);
    prisma.dashboard.findMany.mockResolvedValue([{ id: "d3" }, { id: "d1" }] as never);

    const result = await replaceTeamDashboardLimits(ORG, TEAM, ["d3", "d1", "d3"]);

    expect(prisma.teamDashboard.deleteMany).toHaveBeenCalledWith({
      where: { teamId: TEAM, dashboardId: { in: ["d2"] } },
    });
    expect(prisma.teamDashboard.createMany).toHaveBeenCalledWith({
      data: [{ teamId: TEAM, dashboardId: "d3" }],
    });
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: TEAM },
      data: { dashboardLimited: true },
    });
    expect(result).toEqual({
      before: { teamId: TEAM, limited: false, dashboardIds: ["d1", "d2"] },
      after: { teamId: TEAM, limited: true, dashboardIds: ["d1", "d3"] },
    });
  });

  test("clears dashboardLimited for an empty list without checking dashboards", async () => {
    prisma.team.findFirst.mockResolvedValue({
      dashboardLimited: true,
      dashboardLimits: [{ dashboardId: "d1" }],
    } as never);

    const result = await replaceTeamDashboardLimits(ORG, TEAM, []);

    expect(prisma.dashboard.findMany).not.toHaveBeenCalled();
    expect(prisma.teamDashboard.deleteMany).toHaveBeenCalledWith({
      where: { teamId: TEAM, dashboardId: { in: ["d1"] } },
    });
    expect(prisma.teamDashboard.createMany).not.toHaveBeenCalled();
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: TEAM },
      data: { dashboardLimited: false },
    });
    expect(result?.after).toEqual({ teamId: TEAM, limited: false, dashboardIds: [] });
  });

  test("leaves dashboardLimited alone when it does not change", async () => {
    prisma.team.findFirst.mockResolvedValue({
      dashboardLimited: true,
      dashboardLimits: [{ dashboardId: "d1" }],
    } as never);
    prisma.dashboard.findMany.mockResolvedValue([{ id: "d1" }] as never);

    await replaceTeamDashboardLimits(ORG, TEAM, ["d1"]);

    expect(prisma.team.update).not.toHaveBeenCalled();
    expect(prisma.teamDashboard.deleteMany).not.toHaveBeenCalled();
    expect(prisma.teamDashboard.createMany).not.toHaveBeenCalled();
  });
});

describe("deleteTeamDashboardLimitsInWorkspaces", () => {
  const tx = prisma as unknown as Prisma.TransactionClient;

  test("does nothing for no workspaces", async () => {
    await deleteTeamDashboardLimitsInWorkspaces(tx, TEAM, []);
    expect(prisma.teamDashboard.deleteMany).not.toHaveBeenCalled();
  });

  test("removes the team's limits on dashboards of those workspaces", async () => {
    await deleteTeamDashboardLimitsInWorkspaces(tx, TEAM, ["ws_1", "ws_2"]);
    expect(prisma.teamDashboard.deleteMany).toHaveBeenCalledWith({
      where: { teamId: TEAM, dashboard: { workspaceId: { in: ["ws_1", "ws_2"] } } },
    });
  });
});
