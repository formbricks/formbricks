import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getTeamsByProjectId } from "./team";

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    team: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/cache/team", () => ({ teamCache: { tag: { byProjectId: vi.fn(), byId: vi.fn() } } }));
vi.mock("@/lib/project/cache", () => ({ projectCache: { tag: { byId: vi.fn() } } }));

const mockProject = { id: "p1" };
const mockTeams = [
  {
    id: "t1",
    name: "Team 1",
    projectTeams: [{ permission: "readWrite" }],
    _count: { teamUsers: 2 },
  },
  {
    id: "t2",
    name: "Team 2",
    projectTeams: [{ permission: "manage" }],
    _count: { teamUsers: 3 },
  },
];

describe("getTeamsByProjectId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns mapped teams for valid project", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(mockProject);
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockTeams);
    const result = await getTeamsByProjectId("p1");
    expect(result).toEqual([
      { id: "t1", name: "Team 1", permission: "readWrite", memberCount: 2 },
      { id: "t2", name: "Team 2", permission: "manage", memberCount: 3 },
    ]);
    expect(prisma.project.findUnique).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(prisma.team.findMany).toHaveBeenCalled();
  });

  test("throws ResourceNotFoundError if project does not exist", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);
    await expect(getTeamsByProjectId("p1")).rejects.toThrow(ResourceNotFoundError);
  });

  test("throws DatabaseError on Prisma known error", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(mockProject);
    vi.mocked(prisma.team.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" })
    );
    await expect(getTeamsByProjectId("p1")).rejects.toThrow(DatabaseError);
  });

  test("throws unknown error on unexpected error", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(mockProject);
    vi.mocked(prisma.team.findMany).mockRejectedValueOnce(new Error("unexpected"));
    await expect(getTeamsByProjectId("p1")).rejects.toThrow("unexpected");
  });
});
