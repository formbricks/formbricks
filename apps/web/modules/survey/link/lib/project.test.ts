import { validateInputs } from "@/lib/utils/validate";
import { TProjectByEnvironmentId } from "@/modules/survey/link/types/project";
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

    expect(validateInputs).toHaveBeenCalledWith([environmentId], ["environmentId"]);
  });

  test("should return project data when found", async () => {
    const environmentId = "test-environment-id";
    const mockProject: TProjectByEnvironmentId = {
      id: "project-id",
      languages: [],
      brandColor: "#000000",
      highlightBorderColor: "#000000",
      placement: {
        id: "placement-id",
        enabled: true,
        position: "centerModal",
        delay: 0,
        autoClose: 10,
        autoCloseOnProgressBar: true,
        pulseDisabled: false,
      },
      clickOutsideClose: true,
      darkOverlay: false,
      styling: {},
      logo: null,
      previewMode: false,
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
        id: true,
        languages: true,
        brandColor: true,
        highlightBorderColor: true,
        placement: true,
        clickOutsideClose: true,
        darkOverlay: true,
        styling: true,
        logo: true,
        previewMode: true,
      },
    });
  });

  test("should handle Prisma errors", async () => {
    const environmentId = "test-environment-id";
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      clientVersion: "1.0.0",
      code: "P2002",
    });

    vi.mocked(prisma.project.findFirst).mockRejectedValueOnce(prismaError);

    await expect(getProjectByEnvironmentId(environmentId)).rejects.toThrow(DatabaseError);
  });

  test("should rethrow non-Prisma errors", async () => {
    const environmentId = "test-environment-id";
    const genericError = new Error("Generic error");

    vi.mocked(prisma.project.findFirst).mockRejectedValueOnce(genericError);

    await expect(getProjectByEnvironmentId(environmentId)).rejects.toThrow(genericError);
  });
});
