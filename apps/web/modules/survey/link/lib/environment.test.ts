import { Prisma } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { getWorkspaceContextForLinkSurvey } from "./environment";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock React cache
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

describe("getWorkspaceContextForLinkSurvey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should successfully fetch workspace context with all required data", async () => {
    const mockWorkspaceId = "clh1a2b3c4d5e6f7g8h9j";
    const mockData = {
      id: mockWorkspaceId,
      name: "Test Workspace",
      styling: { primaryColor: "#000000" },
      logo: { url: "https://example.com/logo.png" },
      linkSurveyBranding: true,
      customHeadScripts: null,
      organizationId: "clh1a2b3c4d5e6f7g8h9k",
      organization: {
        id: "clh1a2b3c4d5e6f7g8h9k",
        billing: {
          stripeCustomerId: null,
          limits: {
            monthly: {
              responses: 100,
            },
            workspaces: 3,
          },
          usageCycleAnchor: new Date("2026-01-01T00:00:00.000Z"),
          stripe: null,
        },
        whitelabel: null,
      },
    };

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockData as any);

    const result = await getWorkspaceContextForLinkSurvey(mockWorkspaceId);

    expect(result).toEqual({
      workspace: {
        id: mockWorkspaceId,
        name: "Test Workspace",
        styling: { primaryColor: "#000000" },
        logo: { url: "https://example.com/logo.png" },
        linkSurveyBranding: true,
        customHeadScripts: null,
      },
      organizationId: "clh1a2b3c4d5e6f7g8h9k",
      organizationBilling: {
        stripeCustomerId: null,
        limits: {
          monthly: { responses: 100 },
          workspaces: 3,
        },
        usageCycleAnchor: new Date("2026-01-01T00:00:00.000Z"),
      },
      organizationWhitelabel: null,
    });

    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: mockWorkspaceId },
      select: {
        id: true,
        name: true,
        styling: true,
        logo: true,
        linkSurveyBranding: true,
        customHeadScripts: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            billing: {
              select: {
                stripeCustomerId: true,
                limits: true,
                usageCycleAnchor: true,
                stripe: true,
              },
            },
            whitelabel: true,
          },
        },
      },
    });
  });

  test("should throw ValidationError for invalid workspace ID", async () => {
    const invalidId = "invalid-id";

    await expect(getWorkspaceContextForLinkSurvey(invalidId)).rejects.toThrow(ValidationError);
  });

  test("should throw ResourceNotFoundError when workspace is not found", async () => {
    const mockWorkspaceId = "clh1a2b3c4d5e6f7g8h9m";

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    await expect(getWorkspaceContextForLinkSurvey(mockWorkspaceId)).rejects.toThrow(ResourceNotFoundError);
    await expect(getWorkspaceContextForLinkSurvey(mockWorkspaceId)).rejects.toThrow("Workspace");
  });

  test("should throw ResourceNotFoundError when workspace has no organization", async () => {
    const mockWorkspaceId = "clh1a2b3c4d5e6f7g8h9n";
    const mockData = {
      id: mockWorkspaceId,
      name: "Test Workspace",
      styling: {},
      logo: null,
      linkSurveyBranding: true,
      customHeadScripts: null,
      organizationId: "clh1a2b3c4d5e6f7g8h9p",
      organization: null,
    };

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockData as any);

    await expect(getWorkspaceContextForLinkSurvey(mockWorkspaceId)).rejects.toThrow(ResourceNotFoundError);
    await expect(getWorkspaceContextForLinkSurvey(mockWorkspaceId)).rejects.toThrow("Organization");
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const mockWorkspaceId = "clh1a2b3c4d5e6f7g8h9q";
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2025",
      clientVersion: "5.0.0",
    });

    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(prismaError);

    await expect(getWorkspaceContextForLinkSurvey(mockWorkspaceId)).rejects.toThrow(DatabaseError);
    await expect(getWorkspaceContextForLinkSurvey(mockWorkspaceId)).rejects.toThrow("Database error");
  });

  test("should rethrow non-Prisma errors", async () => {
    const mockWorkspaceId = "clh1a2b3c4d5e6f7g8h9r";
    const genericError = new Error("Generic error");

    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(genericError);

    await expect(getWorkspaceContextForLinkSurvey(mockWorkspaceId)).rejects.toThrow(genericError);
  });

  test("should handle workspace with minimal data", async () => {
    const mockWorkspaceId = "clh1a2b3c4d5e6f7g8h9s";
    const mockData = {
      id: mockWorkspaceId,
      name: "Minimal Workspace",
      styling: null,
      logo: null,
      linkSurveyBranding: false,
      customHeadScripts: null,
      organizationId: "clh1a2b3c4d5e6f7g8h9u",
      organization: {
        id: "clh1a2b3c4d5e6f7g8h9u",
        billing: {
          stripeCustomerId: null,
          limits: {
            monthly: {
              responses: 100,
            },
            workspaces: 3,
          },
          usageCycleAnchor: new Date("2026-01-01T00:00:00.000Z"),
          stripe: null,
        },
        whitelabel: null,
      },
    };

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockData as any);

    const result = await getWorkspaceContextForLinkSurvey(mockWorkspaceId);

    expect(result).toEqual({
      workspace: {
        id: mockWorkspaceId,
        name: "Minimal Workspace",
        styling: null,
        logo: null,
        linkSurveyBranding: false,
        customHeadScripts: null,
      },
      organizationId: "clh1a2b3c4d5e6f7g8h9u",
      organizationBilling: {
        stripeCustomerId: null,
        limits: {
          monthly: { responses: 100 },
          workspaces: 3,
        },
        usageCycleAnchor: new Date("2026-01-01T00:00:00.000Z"),
      },
      organizationWhitelabel: null,
    });
  });
});
