import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { OrganizationRole, Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { createTeamMembership } from "./team";

vi.mock("@formbricks/database", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
    },
    teamUser: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authzed/team-workspace", () => ({
  reconcileTeamWorkspaceRelationships: vi.fn(),
}));

describe("createTeamMembership", () => {
  const mockInvite = {
    teamIds: ["team1", "team2"],
    role: "owner" as OrganizationRole,
    organizationId: "org1",
  };
  const mockUserId = "user1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates team memberships and revalidates caches", async () => {
    const mockTeam = {
      workspaceTeams: [{ workspaceId: "workspace1" }],
    };

    vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.teamUser.upsert).mockResolvedValue({} as any);

    await createTeamMembership(mockInvite, mockUserId);

    expect(prisma.team.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.teamUser.upsert).toHaveBeenCalledTimes(2);
    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
      teamMemberships: [
        { teamId: "team1", userId: mockUserId },
        { teamId: "team2", userId: mockUserId },
      ],
    });
  });

  test("handles database errors", async () => {
    const dbError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.team.findUnique).mockRejectedValue(dbError);

    await expect(createTeamMembership(mockInvite, mockUserId)).rejects.toThrow(DatabaseError);
    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({ teamMemberships: [] });
  });

  test("reconciles successfully committed pairs before propagating a later source failure", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: "team" } as any);
    vi.mocked(prisma.teamUser.upsert)
      .mockResolvedValueOnce({} as any)
      .mockRejectedValueOnce(new Error("second write failed"));

    await expect(createTeamMembership(mockInvite, mockUserId)).rejects.toThrow("second write failed");

    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
      teamMemberships: [{ teamId: "team1", userId: mockUserId }],
    });
  });
});
