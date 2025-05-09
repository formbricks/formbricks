import { cache } from "@/lib/cache";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { getProjectByEnvironmentId } from "./project";

// Mock dependencies
vi.mock("@/lib/cache");

vi.mock("@/lib/project/cache", () => ({
  projectCache: {
    tag: {
      byEnvironmentId: (id: string) => `project-environment-${id}`,
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

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

vi.mock("react", () => ({
  cache: (fn: any) => fn,
}));

describe("getProjectByEnvironmentId", () => {
  const environmentId = "env-123";
  const mockProject = {
    styling: { primaryColor: "#123456" },
    logo: "logo.png",
    linkSurveyBranding: true,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
  });

  test("should call cache with correct parameters", async () => {
    await getProjectByEnvironmentId(environmentId);

    expect(cache).toHaveBeenCalledWith(
      expect.any(Function),
      [`survey-link-surveys-getProjectByEnvironmentId-${environmentId}`],
      {
        tags: [`project-environment-${environmentId}`],
      }
    );
  });

  test("should validate inputs", async () => {
    // Call the function to ensure cache is called
    await getProjectByEnvironmentId(environmentId);

    // Now we can safely access the first call
    const cacheCallback = vi.mocked(cache).mock.calls[0][0];

    // Execute the callback directly to verify it calls validateInputs
    await cacheCallback();

    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]);
  });

  test("should return project data when found", async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject);

    // Set up cache mock to execute the callback
    vi.mocked(cache).mockImplementation((cb) => async () => cb());

    const result = await getProjectByEnvironmentId(environmentId);

    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: {
        environments: {
          some: {
            id: environmentId,
          },
        },
      },
      select: {
        styling: true,
        logo: true,
        linkSurveyBranding: true,
      },
    });

    expect(result).toEqual(mockProject);
  });

  test("should handle Prisma errors", async () => {
    // Create a proper mock of PrismaClientKnownRequestError
    const prismaError = Object.create(Prisma.PrismaClientKnownRequestError.prototype);
    Object.defineProperty(prismaError, "message", { value: "Database error" });
    Object.defineProperty(prismaError, "code", { value: "P2002" });
    Object.defineProperty(prismaError, "clientVersion", { value: "4.0.0" });
    Object.defineProperty(prismaError, "meta", { value: {} });

    vi.mocked(prisma.project.findFirst).mockRejectedValue(prismaError);

    // Set up cache mock to execute the callback
    vi.mocked(cache).mockImplementation((cb) => async () => cb());

    await expect(getProjectByEnvironmentId(environmentId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error fetching project by environment id");
  });

  test("should rethrow non-Prisma errors", async () => {
    const genericError = new Error("Generic error");

    vi.mocked(prisma.project.findFirst).mockRejectedValue(genericError);

    // Set up cache mock to execute the callback
    vi.mocked(cache).mockImplementation((cb) => async () => cb());

    await expect(getProjectByEnvironmentId(environmentId)).rejects.toThrow(genericError);
  });
});
