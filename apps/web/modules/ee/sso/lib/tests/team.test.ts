import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { validateInputs } from "@/lib/utils/validate";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { createDefaultTeamMembership, getOrganizationByTeamId } from "../team";
import {
  MOCK_DEFAULT_TEAM,
  MOCK_DEFAULT_TEAM_USER,
  MOCK_IDS,
  MOCK_ORGANIZATION_MEMBERSHIP,
} from "./__mock__/team.mock";

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
    },
  }));

  vi.mock("@/lib/utils/validate", () => ({
    validateInputs: vi.fn((args) => args),
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

  describe("getOrganizationByTeamId", () => {
    const mockOrganization = { id: "org-1", name: "Test Org" };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    test("returns organization when team is found", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({
        organization: mockOrganization,
      } as any);

      const result = await getOrganizationByTeamId("team-1");
      expect(result).toEqual(mockOrganization);
      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: "team-1" },
        select: { organization: true },
      });
    });

    test("returns null when team is not found", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValueOnce(null);

      const result = await getOrganizationByTeamId("team-2");
      expect(result).toBeNull();
    });

    test("returns null and logs error when prisma throws", async () => {
      const error = new Error("DB error");
      vi.mocked(prisma.team.findUnique).mockRejectedValueOnce(error);

      const result = await getOrganizationByTeamId("team-3");
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(error, "Error getting organization by team id team-3");
    });

    test("calls validateInputs with correct arguments", async () => {
      const mockTeamId = "team-xyz";
      vi.mocked(prisma.team.findUnique).mockResolvedValueOnce({ organization: mockOrganization } as any);

      await getOrganizationByTeamId(mockTeamId);
      expect(validateInputs).toHaveBeenCalledWith([mockTeamId, expect.anything()]);
    });
  });
});
