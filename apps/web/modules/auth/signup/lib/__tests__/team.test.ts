import { MOCK_IDS, MOCK_INVITE, MOCK_TEAM_USER } from "./__mocks__/team-mocks";
import { OrganizationRole } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { CreateMembershipInvite } from "@/modules/auth/signup/types/invites";
import { createTeamMembership, getTeamForOrganization } from "../team";

// Setup all mocks
const setupMocks = () => {
  // Mock dependencies
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

  vi.mock("@/lib/constants", () => ({
    DEFAULT_TEAM_ID: "team-123",
    DEFAULT_ORGANIZATION_ID: "org-123",
  }));

  vi.mock("@/lib/membership/service", () => ({
    getMembershipByUserIdOrganizationId: vi.fn(),
  }));

  vi.mock("@formbricks/logger", () => ({
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
    },
  }));

  // Mock reactCache to control the getDefaultTeam function
  vi.mock("react", async () => {
    const actual = await vi.importActual("react");
    return {
      ...actual,
      cache: vi.fn().mockImplementation((fn) => fn),
    };
  });
};

// Set up mocks
setupMocks();

describe("Team Management", () => {
  const mockTeamLookup = { id: MOCK_IDS.teamId };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTeamMembership", () => {
    describe("when user is an admin", () => {
      test("creates a team membership with admin role", async () => {
        vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeamLookup as any);
        vi.mocked(prisma.teamUser.upsert).mockResolvedValue(MOCK_TEAM_USER as any);

        await createTeamMembership(MOCK_INVITE, MOCK_IDS.userId);
        expect(prisma.team.findUnique).toHaveBeenCalledWith({
          where: {
            id: MOCK_IDS.teamId,
            organizationId: MOCK_IDS.organizationId,
          },
          select: {
            id: true,
          },
        });

        expect(prisma.teamUser.upsert).toHaveBeenCalledWith({
          create: {
            teamId: MOCK_IDS.teamId,
            userId: MOCK_IDS.userId,
            role: "admin",
          },
          update: {
            role: "admin",
          },
          where: {
            teamId_userId: {
              teamId: MOCK_IDS.teamId,
              userId: MOCK_IDS.userId,
            },
          },
        });
      });
    });

    describe("when user is not an admin", () => {
      test("creates a team membership with contributor role", async () => {
        const nonAdminInvite: CreateMembershipInvite = {
          ...MOCK_INVITE,
          role: "member" as OrganizationRole,
        };

        vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeamLookup as any);
        vi.mocked(prisma.teamUser.upsert).mockResolvedValue({
          ...MOCK_TEAM_USER,
          role: "contributor",
        } as any);

        await createTeamMembership(nonAdminInvite, MOCK_IDS.userId);

        expect(prisma.teamUser.upsert).toHaveBeenCalledWith({
          create: {
            teamId: MOCK_IDS.teamId,
            userId: MOCK_IDS.userId,
            role: "contributor",
          },
          update: {
            role: "contributor",
          },
          where: {
            teamId_userId: {
              teamId: MOCK_IDS.teamId,
              userId: MOCK_IDS.userId,
            },
          },
        });
      });
    });

    describe("error handling", () => {
      test("throws error when database operation fails", async () => {
        vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeamLookup as any);
        vi.mocked(prisma.teamUser.upsert).mockRejectedValue(new Error("Database error"));

        await expect(createTeamMembership(MOCK_INVITE, MOCK_IDS.userId)).rejects.toThrow("Database error");
      });
    });

    describe("when team does not exist", () => {
      test("skips membership creation and continues to next team", async () => {
        const inviteWithMultipleTeams: CreateMembershipInvite = {
          ...MOCK_INVITE,
          teamIds: ["non-existent-team", MOCK_IDS.teamId],
        };

        vi.mocked(prisma.team.findUnique)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockTeamLookup as any);
        vi.mocked(prisma.teamUser.upsert).mockResolvedValue(MOCK_TEAM_USER as any);

        await createTeamMembership(inviteWithMultipleTeams, MOCK_IDS.userId);

        expect(prisma.team.findUnique).toHaveBeenCalledTimes(2);
        expect(prisma.teamUser.upsert).toHaveBeenCalledTimes(1);
        expect(prisma.teamUser.upsert).toHaveBeenCalledWith({
          create: {
            teamId: MOCK_IDS.teamId,
            userId: MOCK_IDS.userId,
            role: "admin",
          },
          update: {
            role: "admin",
          },
          where: {
            teamId_userId: {
              teamId: MOCK_IDS.teamId,
              userId: MOCK_IDS.userId,
            },
          },
        });
      });
    });
  });

  describe("getTeamForOrganization", () => {
    test("returns the team when it exists in the organization", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeamLookup as any);

      const result = await getTeamForOrganization(MOCK_IDS.teamId, MOCK_IDS.organizationId);

      expect(result).toEqual(mockTeamLookup);
      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: {
          id: MOCK_IDS.teamId,
          organizationId: MOCK_IDS.organizationId,
        },
        select: {
          id: true,
        },
      });
    });

    test("returns null when team does not exist", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const result = await getTeamForOrganization(MOCK_IDS.teamId, MOCK_IDS.organizationId);

      expect(result).toBeNull();
    });

    test("uses the transaction client directly when provided", async () => {
      const tx = {
        team: {
          findUnique: vi.fn().mockResolvedValue(mockTeamLookup),
        },
      } as any;

      const result = await getTeamForOrganization(MOCK_IDS.teamId, MOCK_IDS.organizationId, tx);

      expect(result).toEqual(mockTeamLookup);
      expect(tx.team.findUnique).toHaveBeenCalledWith({
        where: {
          id: MOCK_IDS.teamId,
          organizationId: MOCK_IDS.organizationId,
        },
        select: {
          id: true,
        },
      });
      expect(prisma.team.findUnique).not.toHaveBeenCalled();
    });
  });
});
