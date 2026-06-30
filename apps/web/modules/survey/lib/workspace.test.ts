import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma, Workspace } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { getWorkspaceWithTeamIds } from "./workspace";

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

// Mock reactCache as it's a React-specific import and not needed for these tests
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

const workspaceId = "test-workspace-id";
const mockWorkspacePrisma = {
  id: workspaceId,
  name: "Test Workspace",
  createdAt: new Date(),
  updatedAt: new Date(),
  createdById: null,
  workspaceTeams: [{ teamId: "team1" }, { teamId: "team2" }],
  surveys: [],
  webhooks: [],
  apiKey: null,
  styling: {
    allowStyleOverwrite: true,
  },
  variables: {},
  languages: [],
  recontactDays: 0,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  placement: "bottomRight",
  clickOutsideClose: false,
  overlay: "none",
  segment: null,
  surveyClosedMessage: null,
  organizationId: "clq6167un000008l56jd8s3f9",
  config: { channel: "app", industry: "eCommerce" },
  logo: null,
} as unknown as Workspace;

const mockWorkspaceWithTeam: Workspace & { teamIds: string[] } = {
  ...mockWorkspacePrisma,
  teamIds: ["team1", "team2"],
};

describe("getWorkspaceWithTeamIds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return workspace with team IDs when workspace is found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspacePrisma);

    const workspace = await getWorkspaceWithTeamIds(workspaceId);

    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: {
        id: workspaceId,
      },
      include: {
        workspaceTeams: {
          select: {
            teamId: true,
          },
        },
      },
    });

    expect(workspace).toEqual(mockWorkspaceWithTeam);
  });

  test("should return null when workspace is not found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const workspace = await getWorkspaceWithTeamIds(workspaceId);

    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: {
        id: workspaceId,
      },
      include: {
        workspaceTeams: {
          select: {
            teamId: true,
          },
        },
      },
    });
    expect(workspace).toBeNull();
  });

  test("should throw DatabaseError when prisma query fails", async () => {
    const mockErrorMessage = "Prisma error";
    const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
      code: PrismaErrorType.UniqueConstraintViolation,
      clientVersion: "0.0.1",
    });

    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(errToThrow);

    await expect(getWorkspaceWithTeamIds(workspaceId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalled();
  });

  test("should rethrow error if not PrismaClientKnownRequestError", async () => {
    const errorMessage = "Some other error";
    const error = new Error(errorMessage);
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(error);

    await expect(getWorkspaceWithTeamIds(workspaceId)).rejects.toThrow(error);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
