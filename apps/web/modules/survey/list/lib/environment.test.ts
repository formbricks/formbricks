// Retain only vitest import here
// Import modules after mocks
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { doesEnvironmentExist, getEnvironment, getProjectIdIfEnvironmentExists } from "./environment";

vi.mock("@/lib/utils/validate");

vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
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

const mockEnvironmentId = "clxko31qs000008jya8v4ah0a";
const mockProjectId = "clxko31qt000108jyd64v5688";

describe("doesEnvironmentExist", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return environmentId if environment exists", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({ id: mockEnvironmentId });

    const result = await doesEnvironmentExist(mockEnvironmentId);

    expect(result).toBe(mockEnvironmentId);
    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: mockEnvironmentId },
      select: { id: true },
    });
  });

  test("should throw ResourceNotFoundError if environment does not exist", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);

    await expect(doesEnvironmentExist(mockEnvironmentId)).rejects.toThrow(ResourceNotFoundError);
    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: mockEnvironmentId },
      select: { id: true },
    });
  });
});

describe("getProjectIdIfEnvironmentExists", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return projectId if environment exists", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({ projectId: mockProjectId }); // Ensure correct mock value

    const result = await getProjectIdIfEnvironmentExists(mockEnvironmentId);

    expect(result).toBe(mockProjectId);
    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: mockEnvironmentId },
      select: { projectId: true },
    });
  });

  test("should throw ResourceNotFoundError if environment does not exist", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);

    await expect(getProjectIdIfEnvironmentExists(mockEnvironmentId)).rejects.toThrow(ResourceNotFoundError);
    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: mockEnvironmentId },
      select: { projectId: true },
    });
  });
});

describe("getEnvironment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return environment if it exists", async () => {
    const mockEnvData = { id: mockEnvironmentId, type: "production" as const };
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockEnvData);

    const result = await getEnvironment(mockEnvironmentId);

    expect(result).toEqual(mockEnvData);
    expect(validateInputs).toHaveBeenCalledWith([mockEnvironmentId, expect.any(Object)]);
    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: mockEnvironmentId },
      select: { id: true, type: true },
    });
  });

  test("should return null if environment does not exist (as per select, though findUnique would return null directly)", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);

    const result = await getEnvironment(mockEnvironmentId);
    expect(result).toBeNull();
    expect(validateInputs).toHaveBeenCalledWith([mockEnvironmentId, expect.any(Object)]);
    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: mockEnvironmentId },
      select: { id: true, type: true },
    });
  });

  test("should throw DatabaseError if PrismaClientKnownRequestError occurs", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2001",
      clientVersion: "2.0.0", // Ensure clientVersion is a string
    });
    vi.mocked(prisma.environment.findUnique).mockRejectedValue(prismaError);

    await expect(getEnvironment(mockEnvironmentId)).rejects.toThrow(DatabaseError);
    expect(validateInputs).toHaveBeenCalledWith([mockEnvironmentId, expect.any(Object)]);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error fetching environment");
  });

  test("should re-throw error if a generic error occurs", async () => {
    const genericError = new Error("Test Generic Error");
    vi.mocked(prisma.environment.findUnique).mockRejectedValue(genericError);

    await expect(getEnvironment(mockEnvironmentId)).rejects.toThrow(genericError);
    expect(validateInputs).toHaveBeenCalledWith([mockEnvironmentId, expect.any(Object)]);
    expect(logger.error).not.toHaveBeenCalled();
  });
});

// Remove the global afterEach if it was only for vi.useRealTimers() and no fake timers are used.
// vi.resetAllMocks() in beforeEach is generally the preferred way to ensure test isolation for mocks.
// The specific afterEach(() => { vi.clearAllMocks(); }) inside each describe block can also be removed.
// For consistency, I'll remove the afterEach blocks from the describe suites.
