import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getTeamsByWorkspaceId } from "./team";

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: { findUnique: vi.fn() },
    team: { findMany: vi.fn() },
  },
}));

const mockWorkspace = { id: "p1" };
const mockTeams = [
  {
    id: "t1",
    name: "Team 1",
    workspaceTeams: [{ permission: "readWrite" }],
    _count: { teamUsers: 2 },
  },
  {
    id: "t2",
    name: "Team 2",
    workspaceTeams: [{ permission: "manage" }],
    _count: { teamUsers: 3 },
  },
];

describe("getTeamsByWorkspaceId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns mapped teams for valid workspace", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(mockWorkspace as any);
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce(mockTeams as any);
    const result = await getTeamsByWorkspaceId("p1");
    expect(result).toEqual([
      { id: "t1", name: "Team 1", permission: "readWrite", memberCount: 2 },
      { id: "t2", name: "Team 2", permission: "manage", memberCount: 3 },
    ]);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(prisma.team.findMany).toHaveBeenCalled();
  });

  test("throws ResourceNotFoundError if workspace does not exist", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(null);
    await expect(getTeamsByWorkspaceId("p1")).rejects.toThrow(ResourceNotFoundError);
  });

  test("throws DatabaseError on Prisma known error", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(mockWorkspace as any);
    vi.mocked(prisma.team.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" })
    );
    await expect(getTeamsByWorkspaceId("p1")).rejects.toThrow(DatabaseError);
  });

  test("throws unknown error on unexpected error", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(mockWorkspace as any);
    vi.mocked(prisma.team.findMany).mockRejectedValueOnce(new Error("unexpected"));
    await expect(getTeamsByWorkspaceId("p1")).rejects.toThrow("unexpected");
  });
});
