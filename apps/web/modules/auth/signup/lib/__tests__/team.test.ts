import {
  MOCK_DEFAULT_TEAM,
  MOCK_DEFAULT_TEAM_USER,
  MOCK_IDS,
  MOCK_INVITE,
  MOCK_ORGANIZATION_MEMBERSHIP,
  MOCK_TEAM,
  MOCK_TEAM_USER,
} from "./__mocks__/team-mocks";
import { teamCache } from "@/lib/cache/team";
import { CreateMembershipInvite } from "@/modules/auth/signup/types/invites";
import { OrganizationRole } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { projectCache } from "@formbricks/lib/project/cache";
import { createDefaultTeamMembership, createTeamMembership } from "../team";

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

  vi.mock("@formbricks/lib/constants", () => ({
    DEFAULT_TEAM_ID: "team-123",
    DEFAULT_ORGANIZATION_ID: "org-123",
  }));

  vi.mock("@/lib/cache/team", () => ({
    teamCache: {
      revalidate: vi.fn(),
      tag: {
        byId: vi.fn().mockReturnValue("tag-id"),
        byOrganizationId: vi.fn().mockReturnValue("tag-org-id"),
      },
    },
  }));

  vi.mock("@formbricks/lib/project/cache", () => ({
    projectCache: {
      revalidate: vi.fn(),
    },
  }));

  vi.mock("@formbricks/lib/membership/service", () => ({
    getMembershipByUserIdOrganizationId: vi.fn(),
  }));

  vi.mock("@formbricks/lib/cache", () => ({
    cache: vi.fn((fn) => fn),
  }));

  vi.mock("@formbricks/logger", () => ({
    logger: {
      error: vi.fn(),
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
        vi.mocked(prisma.team.findUnique).mockResolvedValue(MOCK_TEAM);
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

        expect(projectCache.revalidate).toHaveBeenCalledWith({ id: MOCK_IDS.projectId });
        expect(teamCache.revalidate).toHaveBeenCalledWith({ id: MOCK_IDS.teamId });
        expect(teamCache.revalidate).toHaveBeenCalledWith({
          userId: MOCK_IDS.userId,
          organizationId: MOCK_IDS.organizationId,
        });
        expect(projectCache.revalidate).toHaveBeenCalledWith({
          userId: MOCK_IDS.userId,
          organizationId: MOCK_IDS.organizationId,
        });
      });
    });

    describe("when user is not an admin", () => {
      test("creates a team membership with contributor role", async () => {
        const nonAdminInvite: CreateMembershipInvite = {
          ...MOCK_INVITE,
          role: "member" as OrganizationRole,
        };

        vi.mocked(prisma.team.findUnique).mockResolvedValue(MOCK_TEAM);
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
        vi.mocked(prisma.team.findUnique).mockResolvedValue(MOCK_TEAM);
        vi.mocked(prisma.teamUser.create).mockRejectedValue(new Error("Database error"));

        await expect(createTeamMembership(MOCK_INVITE, MOCK_IDS.userId)).rejects.toThrow("Database error");
      });
    });
  });

  describe("createDefaultTeamMembership", () => {
    describe("when all dependencies are available", () => {
      test("creates the default team membership successfully", async () => {
        vi.mocked(prisma.team.findUnique).mockResolvedValue(MOCK_DEFAULT_TEAM);
        vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(MOCK_ORGANIZATION_MEMBERSHIP);
        vi.mocked(prisma.team.findUnique).mockResolvedValue({
          projectTeams: { projectId: ["test-project-id"] },
        });
        vi.mocked(prisma.teamUser.create).mockResolvedValue(MOCK_DEFAULT_TEAM_USER);

        await createDefaultTeamMembership(MOCK_IDS.userId);

        expect(prisma.team.findUnique).toHaveBeenCalledWith({
          where: {
            id: "team-123",
          },
        });

        expect(prisma.teamUser.create).toHaveBeenCalledWith({
          data: {
            teamId: "team-123",
            userId: MOCK_IDS.userId,
            role: "admin",
          },
        });
      });
    });

    describe("error handling", () => {
      test("handles missing default team gracefully", async () => {
        vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
        await createDefaultTeamMembership(MOCK_IDS.userId);
      });

      test("handles missing organization membership gracefully", async () => {
        vi.mocked(prisma.team.findUnique).mockResolvedValue(MOCK_DEFAULT_TEAM);
        vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

        await createDefaultTeamMembership(MOCK_IDS.userId);
      });

      test("handles database errors gracefully", async () => {
        vi.mocked(prisma.team.findUnique).mockResolvedValue(MOCK_DEFAULT_TEAM);
        vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(MOCK_ORGANIZATION_MEMBERSHIP);
        vi.mocked(prisma.teamUser.create).mockRejectedValue(new Error("Database error"));

        await createDefaultTeamMembership(MOCK_IDS.userId);
      });
    });
  });
});
