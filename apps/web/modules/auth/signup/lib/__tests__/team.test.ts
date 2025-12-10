import { MOCK_IDS, MOCK_INVITE, MOCK_TEAM, MOCK_TEAM_USER } from "./__mocks__/team-mocks";
import { OrganizationRole } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { CreateMembershipInvite } from "@/modules/auth/signup/types/invites";
import { createTeamMembership, getTeamProjectIds } from "../team";

// Setup all mocks
const setupMocks = () => {
  // Mock dependencies
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTeamMembership", () => {
    describe("when user is an admin", () => {
      test("creates a team membership with admin role", async () => {
        vi.mocked(prisma.team.findUnique).mockResolvedValue(MOCK_TEAM as unknown as any);
        vi.mocked(prisma.teamUser.create).mockResolvedValue(MOCK_TEAM_USER);

        await createTeamMembership(MOCK_INVITE, MOCK_IDS.userId);
        expect(prisma.team.findUnique).toHaveBeenCalledWith({
          where: {
            id: MOCK_IDS.teamId,
            organizationId: MOCK_IDS.organizationId,
          },
          select: {
            projectTeams: {
              select: {
                projectId: true,
              },
            },
          },
        });

        expect(prisma.teamUser.create).toHaveBeenCalledWith({
          data: {
            teamId: MOCK_IDS.teamId,
            userId: MOCK_IDS.userId,
            role: "admin",
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

        vi.mocked(prisma.team.findUnique).mockResolvedValue(MOCK_TEAM as unknown as any);
        vi.mocked(prisma.teamUser.create).mockResolvedValue({
          ...MOCK_TEAM_USER,
          role: "contributor",
        });

        await createTeamMembership(nonAdminInvite, MOCK_IDS.userId);

        expect(prisma.teamUser.create).toHaveBeenCalledWith({
          data: {
            teamId: MOCK_IDS.teamId,
            userId: MOCK_IDS.userId,
            role: "contributor",
          },
        });
      });
    });

    describe("error handling", () => {
      test("throws error when database operation fails", async () => {
        vi.mocked(prisma.team.findUnique).mockResolvedValue(MOCK_TEAM as unknown as any);
        vi.mocked(prisma.teamUser.create).mockRejectedValue(new Error("Database error"));

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
          .mockResolvedValueOnce(MOCK_TEAM as unknown as any);
        vi.mocked(prisma.teamUser.create).mockResolvedValue(MOCK_TEAM_USER);

        await createTeamMembership(inviteWithMultipleTeams, MOCK_IDS.userId);

        expect(prisma.team.findUnique).toHaveBeenCalledTimes(2);
        expect(prisma.teamUser.create).toHaveBeenCalledTimes(1);
        expect(prisma.teamUser.create).toHaveBeenCalledWith({
          data: {
            teamId: MOCK_IDS.teamId,
            userId: MOCK_IDS.userId,
            role: "admin",
          },
        });
      });
    });
  });

  describe("getTeamProjectIds", () => {
    test("returns team with projectTeams when team exists", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(MOCK_TEAM as unknown as any);

      const result = await getTeamProjectIds(MOCK_IDS.teamId, MOCK_IDS.organizationId);

      expect(result).toEqual(MOCK_TEAM);
      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: {
          id: MOCK_IDS.teamId,
          organizationId: MOCK_IDS.organizationId,
        },
        select: {
          projectTeams: {
            select: {
              projectId: true,
            },
          },
        },
      });
    });

    test("returns null when team does not exist", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const result = await getTeamProjectIds(MOCK_IDS.teamId, MOCK_IDS.organizationId);

      expect(result).toBeNull();
    });
  });
});
