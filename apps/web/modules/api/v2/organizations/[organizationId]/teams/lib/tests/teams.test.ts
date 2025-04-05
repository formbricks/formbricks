import { TGetTeamsFilter } from "@/modules/api/v2/organizations/[organizationId]/teams/types/teams";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { createTeam, getTeams } from "../teams";

// Define a mock team object
const mockTeam = {
  id: "team123",
  organizationId: "org456",
  name: "Test Team",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// Mock prisma methods
vi.mock("@formbricks/database", () => ({
  prisma: {
    team: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock organizationCache.revalidate
vi.spyOn(organizationCache, "revalidate").mockImplementation(() => {});

describe("Teams Lib", () => {
  describe("createTeam", () => {
    it("creates a team successfully and revalidates cache", async () => {
      (prisma.team.create as any).mockResolvedValueOnce(mockTeam);

      const teamInput = { name: "Test Team" };
      const organizationId = "org456";
      const result = await createTeam(teamInput, organizationId);
      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          name: "Test Team",
          organization: { connect: { id: organizationId } },
        },
      });
      expect(organizationCache.revalidate).toHaveBeenCalledWith({ id: organizationId });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual(mockTeam);
    });

    it("returns internal error when prisma.team.create fails", async () => {
      (prisma.team.create as any).mockRejectedValueOnce(new Error("Create error"));
      const teamInput = { name: "Test Team" };
      const organizationId = "org456";
      const result = await createTeam(teamInput, organizationId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toEqual("internal_server_error");
      }
    });
  });

  describe("getTeams", () => {
    const filter = { limit: 10, skip: 0 };
    it("returns teams with meta on success", async () => {
      const teamsArray = [mockTeam];
      // Simulate prisma transaction return [teams, count]
      (prisma.$transaction as any).mockResolvedValueOnce([teamsArray, teamsArray.length]);

      const organizationId = "org456";
      const result = await getTeams(organizationId, filter as TGetTeamsFilter);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          data: teamsArray,
          meta: { total: teamsArray.length, limit: filter.limit, offset: filter.skip },
        });
      }
    });

    it("returns internal_server_error when prisma transaction fails", async () => {
      (prisma.$transaction as any).mockRejectedValueOnce(new Error("Transaction error"));
      const organizationId = "org456";
      const result = await getTeams(organizationId, filter as TGetTeamsFilter);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toEqual("internal_server_error");
      }
    });
  });
});
