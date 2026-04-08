import { Prisma } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { getWorkspaceById } from "./workspace";

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

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

describe("getWorkspaceById", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should validate inputs", async () => {
    const workspaceId = "test-workspace-id";

    await getWorkspaceById(workspaceId);

    expect(validateInputs).toHaveBeenCalledWith([workspaceId, expect.any(Object)]);
  });

  test("should return workspace data when found", async () => {
    const workspaceId = "test-workspace-id";
    const mockWorkspace = {
      id: workspaceId,
      linkSurveyBranding: true,
      logo: null,
      styling: {},
      name: "Test Workspace",
    };

    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(mockWorkspace as any);

    const result = await getWorkspaceById(workspaceId);

    expect(result).toEqual(mockWorkspace);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: {
        id: workspaceId,
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
    const workspaceId = "nonexistent-workspace-id";

    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(null);

    const result = await getWorkspaceById(workspaceId);

    expect(result).toBeNull();
  });

  test("should throw DatabaseError on Prisma known request error", async () => {
    const workspaceId = "test-workspace-id";
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2025",
      clientVersion: "5.0.0",
    });

    vi.mocked(prisma.workspace.findUnique).mockRejectedValueOnce(prismaError);

    await expect(getWorkspaceById(workspaceId)).rejects.toThrow(DatabaseError);
  });

  test("should rethrow non-Prisma errors", async () => {
    const workspaceId = "test-workspace-id";
    const genericError = new Error("Generic error");

    vi.mocked(prisma.workspace.findUnique).mockRejectedValueOnce(genericError);

    await expect(getWorkspaceById(workspaceId)).rejects.toThrow(genericError);
  });
});
