import { Prisma, Workspace } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { getWorkspaceWithTeamIdsByEnvironmentId } from "./workspace";

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

// Mock reactCache as it's a React-specific import and not needed for these tests
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

const environmentId = "test-environment-id";
const mockWorkspacePrisma = {
  id: "clq6167un000008l56jd8s3f9",
  name: "Test Workspace",
  createdAt: new Date(),
  updatedAt: new Date(),
  createdById: null,
  workspaceTeams: [{ teamId: "team1" }, { teamId: "team2" }],
  environments: [],
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
  singleUseId: null,
  productOverwrites: null,
  brandColor: null,
  highlightBorderColor: null,
  responseCount: null,
  organizationId: "clq6167un000008l56jd8s3f9",
  config: { channel: "app", industry: "eCommerce" },
  logo: null,
} as unknown as Workspace;

const mockWorkspaceWithTeam: Workspace & { teamIds: string[] } = {
  ...mockWorkspacePrisma,
  teamIds: ["team1", "team2"],
};

describe("getWorkspaceWithTeamIdsByEnvironmentId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return workspace with team IDs when workspace is found", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue(mockWorkspacePrisma);

    const workspace = await getWorkspaceWithTeamIdsByEnvironmentId(environmentId);

    expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        environments: {
          some: {
            id: environmentId,
          },
        },
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
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

    const workspace = await getWorkspaceWithTeamIdsByEnvironmentId(environmentId);

    expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        environments: {
          some: {
            id: environmentId,
          },
        },
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

    vi.mocked(prisma.workspace.findFirst).mockRejectedValue(errToThrow);

    await expect(getWorkspaceWithTeamIdsByEnvironmentId(environmentId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalled();
  });

  test("should rethrow error if not PrismaClientKnownRequestError", async () => {
    const errorMessage = "Some other error";
    const error = new Error(errorMessage);
    vi.mocked(prisma.workspace.findFirst).mockRejectedValue(error);

    await expect(getWorkspaceWithTeamIdsByEnvironmentId(environmentId)).rejects.toThrow(error);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
