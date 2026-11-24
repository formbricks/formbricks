import { prisma } from "@/lib/__mocks__/database";
import { describe, expect, test, vi } from "vitest";
import { getMemberTeamsByOrganizationId } from "./member-teams";

vi.mock("server-only", () => ({}));

describe("getMemberTeamsByOrganizationId", () => {
  test("lists each member's teams with their role and each invite's teams, skipping unknown ones", async () => {
    prisma.team.findMany.mockResolvedValue([
      {
        id: "team_a",
        name: "Alpha",
        teamUsers: [
          { userId: "u1", role: "admin" },
          { userId: "u2", role: "contributor" },
        ],
        workspaceTeams: [{ permission: "manage", workspace: { name: "Web" } }],
      },
      {
        id: "team_b",
        name: "Beta",
        teamUsers: [{ userId: "u1", role: "contributor" }],
        workspaceTeams: [],
      },
    ] as never);
    prisma.invite.findMany.mockResolvedValue([
      { id: "inv_1", teamIds: ["team_b", "team_gone"] },
      { id: "inv_2", teamIds: [] },
    ] as never);

    const alpha = { id: "team_a", name: "Alpha", workspaceAccess: [{ name: "Web", permission: "manage" }] };
    const beta = { id: "team_b", name: "Beta", workspaceAccess: [] };

    expect(await getMemberTeamsByOrganizationId("org_1")).toEqual({
      teamsByUserId: {
        u1: [
          { ...alpha, role: "admin" },
          { ...beta, role: "contributor" },
        ],
        u2: [{ ...alpha, role: "contributor" }],
      },
      teamsByInviteId: { inv_1: [beta], inv_2: [] },
    });
    expect(prisma.team.findMany.mock.calls[0][0]?.where).toEqual({ organizationId: "org_1" });
    expect(prisma.invite.findMany.mock.calls[0][0]?.where).toEqual({
      organizationId: "org_1",
      acceptorId: null,
    });
  });
});
