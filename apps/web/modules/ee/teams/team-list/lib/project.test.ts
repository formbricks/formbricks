import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { getProjectsByOrganizationId } from "./project";

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: { findMany: vi.fn() },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

const mockProjects = [
  { id: "p1", name: "Project 1" },
  { id: "p2", name: "Project 2" },
];

describe("getProjectsByOrganizationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns mapped projects for valid organization", async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce(mockProjects);
    const result = await getProjectsByOrganizationId("org1");
    expect(result).toEqual([
      { id: "p1", name: "Project 1" },
      { id: "p2", name: "Project 2" },
    ]);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org1" },
      select: { id: true, name: true },
    });
  });

  test("throws DatabaseError on Prisma known error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" });
    vi.mocked(prisma.project.findMany).mockRejectedValueOnce(error);
    await expect(getProjectsByOrganizationId("org1")).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(error, "Error fetching projects by organization id");
  });

  test("throws UnknownError on unknown error", async () => {
    const error = new Error("fail");
    vi.mocked(prisma.project.findMany).mockRejectedValueOnce(error);
    await expect(getProjectsByOrganizationId("org1")).rejects.toThrow(UnknownError);
  });
});
