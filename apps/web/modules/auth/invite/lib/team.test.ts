import { OrganizationRole, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { createTeamMembership } from "./team";

vi.mock("@formbricks/database", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
    },
    teamUser: {
      create: vi.fn(),
    },
  },
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
      projectTeams: [{ projectId: "project1" }],
    };

    vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.teamUser.create).mockResolvedValue({} as any);

    await createTeamMembership(mockInvite, mockUserId);

    expect(prisma.team.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.teamUser.create).toHaveBeenCalledTimes(2);
  });

  test("handles database errors", async () => {
    const dbError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.team.findUnique).mockRejectedValue(dbError);

    await expect(createTeamMembership(mockInvite, mockUserId)).rejects.toThrow(DatabaseError);
  });
});
