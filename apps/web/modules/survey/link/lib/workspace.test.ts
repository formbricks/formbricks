import { Prisma } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { getWorkspaceByEnvironmentId } from "./workspace";

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("getWorkspaceByEnvironmentId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should validate inputs", async () => {
    const environmentId = "test-environment-id";

    await getWorkspaceByEnvironmentId(environmentId);

    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]);
  });

  test("should return workspace data when found", async () => {
    const environmentId = "test-env-id";
    const mockWorkspace = {
      id: "workspace-id",
      linkSurveyBranding: true,
      logo: null,
      styling: {},
      name: "Test Workspace",
    };

    vi.mocked(prisma.workspace.findFirst).mockResolvedValueOnce(mockWorkspace as any);

    const result = await getWorkspaceByEnvironmentId(environmentId);

    expect(result).toEqual(mockWorkspace);
    expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        environments: {
          some: {
            id: environmentId,
          },
        },
      },
      select: {
        customHeadScripts: true,
        linkSurveyBranding: true,
        logo: true,
        styling: true,
        name: true,
      },
    });
  });

  test("should return null when workspace not found", async () => {
    const environmentId = "nonexistent-env-id";

    vi.mocked(prisma.workspace.findFirst).mockResolvedValueOnce(null);

    const result = await getWorkspaceByEnvironmentId(environmentId);

    expect(result).toBeNull();
  });

  test("should throw DatabaseError on Prisma known request error", async () => {
    const environmentId = "test-env-id";
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2025",
      clientVersion: "5.0.0",
    });

    vi.mocked(prisma.workspace.findFirst).mockRejectedValueOnce(prismaError);

    await expect(getWorkspaceByEnvironmentId(environmentId)).rejects.toThrow(DatabaseError);
  });

  test("should rethrow non-Prisma errors", async () => {
    const environmentId = "test-env-id";
    const genericError = new Error("Generic error");

    vi.mocked(prisma.workspace.findFirst).mockRejectedValueOnce(genericError);

    await expect(getWorkspaceByEnvironmentId(environmentId)).rejects.toThrow(genericError);
  });
});
