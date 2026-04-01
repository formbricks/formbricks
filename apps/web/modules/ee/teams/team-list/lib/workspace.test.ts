import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { getWorkspacesByOrganizationId } from "./workspace";

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: { findMany: vi.fn() },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

const mockWorkspaces = [
  { id: "p1", name: "Workspace 1" },
  { id: "p2", name: "Workspace 2" },
];

describe("getWorkspacesByOrganizationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns mapped workspaces for valid organization", async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValueOnce(mockWorkspaces as any);
    const result = await getWorkspacesByOrganizationId("org1");
    expect(result).toEqual([
      { id: "p1", name: "Workspace 1" },
      { id: "p2", name: "Workspace 2" },
    ]);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org1" },
      select: { id: true, name: true },
    });
  });

  test("throws DatabaseError on Prisma known error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" });
    vi.mocked(prisma.workspace.findMany).mockRejectedValueOnce(error);
    await expect(getWorkspacesByOrganizationId("org1")).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(error, "Error fetching workspaces by organization id");
  });

  test("throws UnknownError on unknown error", async () => {
    const error = new Error("fail");
    vi.mocked(prisma.workspace.findMany).mockRejectedValueOnce(error);
    await expect(getWorkspacesByOrganizationId("org1")).rejects.toThrow(UnknownError);
  });
});
