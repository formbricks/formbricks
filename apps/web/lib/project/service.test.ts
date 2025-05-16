import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { ITEMS_PER_PAGE } from "../constants";
import { getProject, getProjectByEnvironmentId, getProjects, getUserProjects } from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
    },
  },
}));

describe("Project Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("getProject should return a project when it exists", async () => {
    const mockProject = {
      id: createId(),
      name: "Test Project",
      organizationId: createId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      languages: ["en"],
      recontactDays: 0,
      linkSurveyBranding: true,
      inAppSurveyBranding: true,
      config: {},
      placement: "bottomRight",
      clickOutsideClose: true,
      darkOverlay: false,
      environments: [],
      styling: {},
      logo: null,
    };

    vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject);

    const result = await getProject(mockProject.id);

    expect(result).toEqual(mockProject);
    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockProject.id,
      },
      select: expect.any(Object),
    });
  });

  test("getProject should return null when project does not exist", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

    const result = await getProject(createId());

    expect(result).toBeNull();
  });

  test("getProject should throw DatabaseError when prisma throws", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.project.findUnique).mockRejectedValue(prismaError);

    await expect(getProject(createId())).rejects.toThrow(DatabaseError);
  });

  test("getProjectByEnvironmentId should return a project when it exists", async () => {
    const mockProject = {
      id: createId(),
      name: "Test Project",
      organizationId: createId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      languages: ["en"],
      recontactDays: 0,
      linkSurveyBranding: true,
      inAppSurveyBranding: true,
      config: {},
      placement: "bottomRight",
      clickOutsideClose: true,
      darkOverlay: false,
      environments: [],
      styling: {},
      logo: null,
    };

    vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject);

    const result = await getProjectByEnvironmentId(createId());

    expect(result).toEqual(mockProject);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: {
        environments: {
          some: {
            id: expect.any(String),
          },
        },
      },
      select: expect.any(Object),
    });
  });

  test("getProjectByEnvironmentId should return null when project does not exist", async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

    const result = await getProjectByEnvironmentId(createId());

    expect(result).toBeNull();
  });

  test("getProjectByEnvironmentId should throw DatabaseError when prisma throws", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.project.findFirst).mockRejectedValue(prismaError);

    await expect(getProjectByEnvironmentId(createId())).rejects.toThrow(DatabaseError);
  });

  test("getUserProjects should return projects for admin user", async () => {
    const userId = createId();
    const organizationId = createId();
    const mockProjects = [
      {
        id: createId(),
        name: "Test Project 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {},
        placement: "bottomRight",
        clickOutsideClose: true,
        darkOverlay: false,
        environments: [],
        styling: {},
        logo: null,
      },
      {
        id: createId(),
        name: "Test Project 2",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {},
        placement: "bottomRight",
        clickOutsideClose: true,
        darkOverlay: false,
        environments: [],
        styling: {},
        logo: null,
      },
    ];

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: createId(),
      userId,
      organizationId,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects);

    const result = await getUserProjects(userId, organizationId);

    expect(result).toEqual(mockProjects);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
      },
      select: expect.any(Object),
      take: undefined,
      skip: undefined,
    });
  });

  test("getUserProjects should return projects for member user", async () => {
    const userId = createId();
    const organizationId = createId();
    const mockProjects = [
      {
        id: createId(),
        name: "Test Project 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {},
        placement: "bottomRight",
        clickOutsideClose: true,
        darkOverlay: false,
        environments: [],
        styling: {},
        logo: null,
      },
    ];

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: createId(),
      userId,
      organizationId,
      role: "member",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects);

    const result = await getUserProjects(userId, organizationId);

    expect(result).toEqual(mockProjects);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        projectTeams: {
          some: {
            team: {
              teamUsers: {
                some: {
                  userId,
                },
              },
            },
          },
        },
      },
      select: expect.any(Object),
      take: undefined,
      skip: undefined,
    });
  });

  test("getUserProjects should throw ValidationError when user is not a member of organization", async () => {
    const userId = createId();
    const organizationId = createId();

    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);

    await expect(getUserProjects(userId, organizationId)).rejects.toThrow(ValidationError);
  });

  test("getUserProjects should handle pagination", async () => {
    const userId = createId();
    const organizationId = createId();
    const mockProjects = [
      {
        id: createId(),
        name: "Test Project 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {},
        placement: "bottomRight",
        clickOutsideClose: true,
        darkOverlay: false,
        environments: [],
        styling: {},
        logo: null,
      },
    ];

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: createId(),
      userId,
      organizationId,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects);

    const page = 2;
    const result = await getUserProjects(userId, organizationId, page);

    expect(result).toEqual(mockProjects);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
      },
      select: expect.any(Object),
      take: ITEMS_PER_PAGE,
      skip: ITEMS_PER_PAGE * (page - 1),
    });
  });

  test("getProjects should return all projects for an organization", async () => {
    const organizationId = createId();
    const mockProjects = [
      {
        id: createId(),
        name: "Test Project 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {},
        placement: "bottomRight",
        clickOutsideClose: true,
        darkOverlay: false,
        environments: [],
        styling: {},
        logo: null,
      },
      {
        id: createId(),
        name: "Test Project 2",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {},
        placement: "bottomRight",
        clickOutsideClose: true,
        darkOverlay: false,
        environments: [],
        styling: {},
        logo: null,
      },
    ];

    vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects);

    const result = await getProjects(organizationId);

    expect(result).toEqual(mockProjects);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
      },
      select: expect.any(Object),
      take: undefined,
      skip: undefined,
    });
  });

  test("getProjects should handle pagination", async () => {
    const organizationId = createId();
    const mockProjects = [
      {
        id: createId(),
        name: "Test Project 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {},
        placement: "bottomRight",
        clickOutsideClose: true,
        darkOverlay: false,
        environments: [],
        styling: {},
        logo: null,
      },
    ];

    vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects);

    const page = 2;
    const result = await getProjects(organizationId, page);

    expect(result).toEqual(mockProjects);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
      },
      select: expect.any(Object),
      take: ITEMS_PER_PAGE,
      skip: ITEMS_PER_PAGE * (page - 1),
    });
  });

  test("getProjects should throw DatabaseError when prisma throws", async () => {
    const organizationId = createId();
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.project.findMany).mockRejectedValue(prismaError);

    await expect(getProjects(organizationId)).rejects.toThrow(DatabaseError);
  });
});
