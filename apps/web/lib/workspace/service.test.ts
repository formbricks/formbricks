import { createId } from "@paralleldrive/cuid2";
import { OrganizationRole, Prisma, WidgetPlacement, Workspace } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { ITEMS_PER_PAGE } from "../constants";
import { getUserWorkspaces, getWorkspace, getWorkspaces } from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("Workspace Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("getWorkspace should return a workspace when it exists", async () => {
    const mockWorkspace = {
      id: createId(),
      name: "Test Workspace",
      organizationId: createId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      languages: ["en"],
      recontactDays: 0,
      linkSurveyBranding: true,
      inAppSurveyBranding: true,
      config: {
        channel: null,
        industry: null,
      },
      placement: WidgetPlacement.bottomRight,
      clickOutsideClose: true,
      overlay: "none",
      styling: {
        allowStyleOverwrite: true,
      },
      logo: null,
      brandColor: null,
      highlightBorderColor: null,
    };

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspace as unknown as Workspace);

    const result = await getWorkspace(mockWorkspace.id);

    expect(result).toEqual(mockWorkspace);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockWorkspace.id,
      },
      select: expect.any(Object),
    });
  });

  test("getWorkspace should return null when workspace does not exist", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const result = await getWorkspace(createId());

    expect(result).toBeNull();
  });

  test("getWorkspace should throw DatabaseError when prisma throws", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(prismaError);

    await expect(getWorkspace(createId())).rejects.toThrow(DatabaseError);
  });

  test("getUserWorkspaces should return workspaces for admin user", async () => {
    const userId = createId();
    const organizationId = createId();
    const mockWorkspaces = [
      {
        id: createId(),
        name: "Test Workspace 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
      {
        id: createId(),
        name: "Test Workspace 2",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
    ];

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      userId,
      organizationId,
      role: OrganizationRole.owner,
      accepted: true,
    });

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    const result = await getUserWorkspaces(userId, organizationId);

    expect(result).toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
      },
      select: expect.any(Object),
      take: undefined,
      skip: undefined,
    });
  });

  test("getUserWorkspaces should return workspaces for member user", async () => {
    const userId = createId();
    const organizationId = createId();
    const mockWorkspaces = [
      {
        id: createId(),
        name: "Test Workspace 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
    ];

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      userId,
      organizationId,
      role: OrganizationRole.member,
      accepted: true,
    });

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    const result = await getUserWorkspaces(userId, organizationId);

    expect(result).toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        workspaceTeams: {
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

  test("getUserWorkspaces should throw ValidationError when user is not a member of organization", async () => {
    const userId = createId();
    const organizationId = createId();

    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);

    await expect(getUserWorkspaces(userId, organizationId)).rejects.toThrow(ValidationError);
  });

  test("getUserWorkspaces should handle pagination", async () => {
    const userId = createId();
    const organizationId = createId();
    const mockWorkspaces = [
      {
        id: createId(),
        name: "Test Workspace 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
    ];

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      userId,
      organizationId,
      role: OrganizationRole.owner,
      accepted: true,
    });

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    const page = 2;
    const result = await getUserWorkspaces(userId, organizationId, page);

    expect(result).toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
      },
      select: expect.any(Object),
      take: ITEMS_PER_PAGE,
      skip: ITEMS_PER_PAGE * (page - 1),
    });
  });

  test("getWorkspaces should return all workspaces for an organization", async () => {
    const organizationId = createId();
    const mockWorkspaces = [
      {
        id: createId(),
        name: "Test Workspace 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
      {
        id: createId(),
        name: "Test Workspace 2",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
    ];

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    const result = await getWorkspaces(organizationId);

    expect(result).toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
      },
      select: expect.any(Object),
      take: undefined,
      skip: undefined,
    });
  });

  test("getWorkspaces should handle pagination", async () => {
    const organizationId = createId();
    const mockWorkspaces = [
      {
        id: createId(),
        name: "Test Workspace 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
    ];

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    const page = 2;
    const result = await getWorkspaces(organizationId, page);

    expect(result).toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
      },
      select: expect.any(Object),
      take: ITEMS_PER_PAGE,
      skip: ITEMS_PER_PAGE * (page - 1),
    });
  });

  test("getWorkspaces should throw DatabaseError when prisma throws", async () => {
    const organizationId = createId();
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.workspace.findMany).mockRejectedValue(prismaError);

    await expect(getWorkspaces(organizationId)).rejects.toThrow(DatabaseError);
  });
});
