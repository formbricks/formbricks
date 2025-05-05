import { cache } from "@/lib/cache";
import { projectCache } from "@/lib/project/cache";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { TJsEnvironmentStateProject } from "@formbricks/types/js";
import { getProjectForEnvironmentState } from "./project";

// Mock dependencies
vi.mock("@/lib/cache");
vi.mock("@/lib/project/cache");
vi.mock("@formbricks/database", () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));
vi.mock("@/lib/utils/validate"); // Mock validateInputs if needed, though it's often tested elsewhere

const environmentId = "test-environment-id";
const mockProject: TJsEnvironmentStateProject = {
  id: "test-project-id",
  recontactDays: 30,
  clickOutsideClose: true,
  darkOverlay: false,
  placement: "bottomRight",
  inAppSurveyBranding: true,
  styling: { allowStyleOverwrite: false },
};

describe("getProjectForEnvironmentState", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock cache implementation
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });

    // Mock projectCache tags
    vi.mocked(projectCache.tag.byEnvironmentId).mockReturnValue(`project-env-${environmentId}`);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return project state successfully", async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject);

    const result = await getProjectForEnvironmentState(environmentId);

    expect(result).toEqual(mockProject);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: {
        environments: {
          some: {
            id: environmentId,
          },
        },
      },
      select: {
        id: true,
        recontactDays: true,
        clickOutsideClose: true,
        darkOverlay: true,
        placement: true,
        inAppSurveyBranding: true,
        styling: true,
      },
    });
    expect(cache).toHaveBeenCalledTimes(1);
    expect(cache).toHaveBeenCalledWith(
      expect.any(Function),
      [`getProjectForEnvironmentState-${environmentId}`],
      {
        tags: [`project-env-${environmentId}`],
      }
    );
  });

  test("should return null if project not found", async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

    const result = await getProjectForEnvironmentState(environmentId);

    expect(result).toBeNull();
    expect(prisma.project.findFirst).toHaveBeenCalledTimes(1);
    expect(cache).toHaveBeenCalledTimes(1);
  });

  test("should throw DatabaseError on PrismaClientKnownRequestError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
      code: "P2001",
      clientVersion: "test",
    });
    vi.mocked(prisma.project.findFirst).mockRejectedValue(prismaError);

    await expect(getProjectForEnvironmentState(environmentId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting project for environment state");
    expect(cache).toHaveBeenCalledTimes(1);
  });

  test("should re-throw unknown errors", async () => {
    const unknownError = new Error("Something went wrong");
    vi.mocked(prisma.project.findFirst).mockRejectedValue(unknownError);

    await expect(getProjectForEnvironmentState(environmentId)).rejects.toThrow(unknownError);
    expect(logger.error).not.toHaveBeenCalled(); // Should not log unknown errors here
    expect(cache).toHaveBeenCalledTimes(1);
  });
});
