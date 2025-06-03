import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getProjectByEnvironmentId } from "./project";

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

describe("getProjectByEnvironmentId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should validate inputs", async () => {
    const environmentId = "test-environment-id";

    await getProjectByEnvironmentId(environmentId);

    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]);
  });

  test("should return project data when found", async () => {
    const environmentId = "test-env-id";
    const mockProject = {
      id: "project-id",
      linkSurveyBranding: true,
      logo: null,
      styling: {},
    };

    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(mockProject as any);

    const result = await getProjectByEnvironmentId(environmentId);

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
        linkSurveyBranding: true,
        logo: true,
        styling: true,
      },
    });
  });

  test("should return null when project not found", async () => {
    const environmentId = "nonexistent-env-id";

    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(null);

    const result = await getProjectByEnvironmentId(environmentId);

    expect(result).toBeNull();
  });

  test("should throw DatabaseError on Prisma known request error", async () => {
    const environmentId = "test-env-id";
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2025",
      clientVersion: "5.0.0",
    });

    vi.mocked(prisma.project.findFirst).mockRejectedValueOnce(prismaError);

    await expect(getProjectByEnvironmentId(environmentId)).rejects.toThrow(DatabaseError);
  });

  test("should rethrow non-Prisma errors", async () => {
    const environmentId = "test-env-id";
    const genericError = new Error("Generic error");

    vi.mocked(prisma.project.findFirst).mockRejectedValueOnce(genericError);

    await expect(getProjectByEnvironmentId(environmentId)).rejects.toThrow(genericError);
  });
});
