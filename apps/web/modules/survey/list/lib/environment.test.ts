import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { doesWorkspaceExist, getWorkspace } from "./environment";

vi.mock("@/lib/utils/validate");

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("react", async () => {
  const actualReact = await vi.importActual("react");
  return {
    ...actualReact,
    cache: vi.fn((fnToMemoize: (...args: any[]) => any) => fnToMemoize),
  };
});

const mockWorkspaceId = "clxko31qt000108jyd64v5688";

describe("doesWorkspaceExist", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return workspaceId if workspace exists", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ id: mockWorkspaceId } as Awaited<
      ReturnType<typeof prisma.workspace.findUnique>
    >);

    const result = await doesWorkspaceExist(mockWorkspaceId);

    expect(result).toBe(mockWorkspaceId);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: mockWorkspaceId },
      select: { id: true },
    });
  });

  test("should throw ResourceNotFoundError if workspace does not exist", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    await expect(doesWorkspaceExist(mockWorkspaceId)).rejects.toThrow(ResourceNotFoundError);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: mockWorkspaceId },
      select: { id: true },
    });
  });
});

describe("getWorkspace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return workspace if it exists", async () => {
    const mockData = { id: mockWorkspaceId };
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
      mockData as Awaited<ReturnType<typeof prisma.workspace.findUnique>>
    );

    const result = await getWorkspace(mockWorkspaceId);

    expect(result).toEqual(mockData);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: mockWorkspaceId },
      select: { id: true },
    });
  });

  test("should return null if workspace does not exist", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const result = await getWorkspace(mockWorkspaceId);
    expect(result).toBeNull();
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: mockWorkspaceId },
      select: { id: true },
    });
  });

  test("should throw DatabaseError if PrismaClientKnownRequestError occurs", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2001",
      clientVersion: "2.0.0",
    });
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(prismaError);

    await expect(getWorkspace(mockWorkspaceId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error fetching workspace");
  });

  test("should re-throw error if a generic error occurs", async () => {
    const genericError = new Error("Test Generic Error");
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(genericError);

    await expect(getWorkspace(mockWorkspaceId)).rejects.toThrow(genericError);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
