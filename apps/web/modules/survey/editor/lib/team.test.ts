import { TFollowUpEmailToUser } from "@/modules/survey/editor/types/survey-follow-up";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getTeamMemberDetails } from "./team";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    teamUser: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache/team", () => ({
  teamCache: {
    tag: {
      byId: vi.fn((teamId: string) => `team-${teamId}`),
    },
  },
}));

describe("getTeamMemberDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return an empty array if teamIds is empty", async () => {
    const result = await getTeamMemberDetails([]);
    expect(result).toEqual([]);
    expect(prisma.teamUser.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  test("should return unique member details for a single team", async () => {
    const teamId = "team1";
    const mockTeamUsers = [
      { userId: "user1", teamId: teamId },
      { userId: "user2", teamId: teamId },
    ];
    const mockUsers: TFollowUpEmailToUser[] = [
      { email: "user1@example.com", name: "User One" },
      { email: "user2@example.com", name: "User Two" },
    ];

    vi.mocked(prisma.teamUser.findMany).mockResolvedValue(Promise.resolve(mockTeamUsers) as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue(Promise.resolve(mockUsers) as any);

    const result = await getTeamMemberDetails([teamId]);

    expect(prisma.teamUser.findMany).toHaveBeenCalledWith({
      where: { teamId },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["user1", "user2"],
        },
      },
      select: {
        email: true,
        name: true,
      },
    });
    expect(result).toEqual(mockUsers);
  });

  test("should return unique member details and handle multiple teams with overlapping users", async () => {
    const teamIds = ["team1", "team2"];
    const mockTeamUsersTeam1 = [{ userId: "user1", teamId: "team1" }];
    const mockTeamUsersTeam2 = [
      { userId: "user1", teamId: "team2" },
      { userId: "user2", teamId: "team2" },
    ];

    const mockUsersResponseMap = {
      user1: { email: "user1@example.com", name: "User One" },
      user2: { email: "user2@example.com", name: "User Two" },
    };

    vi.mocked(prisma.teamUser.findMany)
      .mockResolvedValueOnce(Promise.resolve(mockTeamUsersTeam1) as any)
      .mockResolvedValueOnce(Promise.resolve(mockTeamUsersTeam2) as any);
    vi.mocked(prisma.user.findMany)
      .mockResolvedValueOnce(Promise.resolve([mockUsersResponseMap.user1]) as any)
      .mockResolvedValueOnce(
        Promise.resolve([mockUsersResponseMap.user1, mockUsersResponseMap.user2]) as any
      );

    const result = await getTeamMemberDetails(teamIds);

    expect(prisma.teamUser.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.teamUser.findMany).toHaveBeenCalledWith({ where: { teamId: "team1" } });
    expect(prisma.teamUser.findMany).toHaveBeenCalledWith({ where: { teamId: "team2" } });

    expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
    // First call for team1 users
    expect(prisma.user.findMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ["user1"] } },
      select: { email: true, name: true },
    });
    // Second call for team2 users
    expect(prisma.user.findMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ["user1", "user2"] } },
      select: { email: true, name: true },
    });

    // Deduplication should ensure each user appears once
    expect(result).toEqual([
      { email: "user1@example.com", name: "User One" },
      { email: "user2@example.com", name: "User Two" },
    ]);
    // Check for uniqueness by email
    const emails = result.map((r) => r.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  test("should return an empty array if a team has no users", async () => {
    const teamId = "teamWithNoUsers";
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue(Promise.resolve([]) as any);
    // prisma.user.findMany will be called with an empty 'in' array if teamUser.findMany returns empty
    vi.mocked(prisma.user.findMany).mockResolvedValue(Promise.resolve([]) as any);

    const result = await getTeamMemberDetails([teamId]);

    expect(prisma.teamUser.findMany).toHaveBeenCalledWith({
      where: { teamId },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [],
        },
      },
      select: {
        email: true,
        name: true,
      },
    });
    expect(result).toEqual([]);
  });

  test("should handle users with null names gracefully", async () => {
    const teamId = "team1";
    const mockTeamUsers = [{ userId: "user1", teamId: teamId }];
    const mockUsers: TFollowUpEmailToUser[] = [{ email: "user1@example.com", name: null as any }]; // Cast to any to satisfy TFollowUpEmailToUser if name is strictly string

    vi.mocked(prisma.teamUser.findMany).mockResolvedValue(Promise.resolve(mockTeamUsers) as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue(Promise.resolve(mockUsers) as any);

    const result = await getTeamMemberDetails([teamId]);
    expect(result).toEqual([{ email: "user1@example.com", name: null }]);
  });
});
