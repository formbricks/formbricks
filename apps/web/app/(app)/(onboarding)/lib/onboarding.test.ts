import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getTeamsByOrganizationId } from "./onboarding";

vi.mock("@formbricks/database", () => ({
  prisma: {
    team: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: (fn: any) => fn,
}));

vi.mock("@/lib/cache/team", () => ({
  teamCache: {
    tag: { byOrganizationId: vi.fn((id: string) => `organization-${id}-teams`) },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("getTeamsByOrganizationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns mapped teams", async () => {
    const mockTeams = [
      { id: "t1", name: "Team 1" },
      { id: "t2", name: "Team 2" },
    ];
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockTeams);
    const result = await getTeamsByOrganizationId("org1");
    expect(result).toEqual([
      { id: "t1", name: "Team 1" },
      { id: "t2", name: "Team 2" },
    ]);
  });

  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.team.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" })
    );
    await expect(getTeamsByOrganizationId("org1")).rejects.toThrow(DatabaseError);
  });

  test("throws error on unknown error", async () => {
    vi.mocked(prisma.team.findMany).mockRejectedValueOnce(new Error("fail"));
    await expect(getTeamsByOrganizationId("org1")).rejects.toThrow("fail");
  });
});
