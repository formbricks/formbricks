import { Prisma, Project } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { getProjectWithTeamIdsByEnvironmentId } from "./project";

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

// Mock reactCache as it's a React-specific import and not needed for these tests
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

const environmentId = "test-environment-id";
const mockProjectPrisma = {
  id: "clq6167un000008l56jd8s3f9",
  name: "Test Project",
  createdAt: new Date(),
  updatedAt: new Date(),
  createdById: null,
  projectTeams: [{ teamId: "team1" }, { teamId: "team2" }],
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
  darkOverlay: false,
  segment: null,
  surveyClosedMessage: null,
  singleUseId: null,
  verifyEmail: null,
  productOverwrites: null,
  brandColor: null,
  highlightBorderColor: null,
  responseCount: null,
  organizationId: "clq6167un000008l56jd8s3f9",
  config: { channel: "app", industry: "eCommerce" },
  logo: null,
} as Project;

const mockProjectWithTeam: Project & { teamIds: string[] } = {
  ...mockProjectPrisma,
  teamIds: ["team1", "team2"],
};

describe("getProjectWithTeamIdsByEnvironmentId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return project with team IDs when project is found", async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProjectPrisma);

    const project = await getProjectWithTeamIdsByEnvironmentId(environmentId);

    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: {
        environments: {
          some: {
            id: environmentId,
          },
        },
      },
      include: {
        projectTeams: {
          select: {
            teamId: true,
          },
        },
      },
    });

    expect(project).toEqual(mockProjectWithTeam);
  });

  test("should return null when project is not found", async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

    const project = await getProjectWithTeamIdsByEnvironmentId(environmentId);

    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: {
        environments: {
          some: {
            id: environmentId,
          },
        },
      },
      include: {
        projectTeams: {
          select: {
            teamId: true,
          },
        },
      },
    });
    expect(project).toBeNull();
  });

  test("should throw DatabaseError when prisma query fails", async () => {
    const mockErrorMessage = "Prisma error";
    const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
      code: PrismaErrorType.UniqueConstraintViolation,
      clientVersion: "0.0.1",
    });

    vi.mocked(prisma.project.findFirst).mockRejectedValue(errToThrow);

    await expect(getProjectWithTeamIdsByEnvironmentId(environmentId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalled();
  });

  test("should rethrow error if not PrismaClientKnownRequestError", async () => {
    const errorMessage = "Some other error";
    const error = new Error(errorMessage);
    vi.mocked(prisma.project.findFirst).mockRejectedValue(error);

    await expect(getProjectWithTeamIdsByEnvironmentId(environmentId)).rejects.toThrow(error);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
