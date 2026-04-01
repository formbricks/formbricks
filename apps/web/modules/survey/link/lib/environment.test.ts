import { Prisma } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { getEnvironmentContextForLinkSurvey } from "./environment";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock React cache
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

describe("getEnvironmentContextForLinkSurvey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should successfully fetch environment context with all required data", async () => {
    const mockEnvironmentId = "clh1a2b3c4d5e6f7g8h9i";
    const mockData = {
      workspace: {
        id: "clh1a2b3c4d5e6f7g8h9j",
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
          },
          whitelabel: null,
        },
      },
    };

    vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockData as any);

    const result = await getEnvironmentContextForLinkSurvey(mockEnvironmentId);

    expect(result).toEqual({
      workspace: {
        id: "clh1a2b3c4d5e6f7g8h9j",
        name: "Test Workspace",
        styling: { primaryColor: "#000000" },
        logo: { url: "https://example.com/logo.png" },
        linkSurveyBranding: true,
        customHeadScripts: null,
      },
      organizationId: "clh1a2b3c4d5e6f7g8h9k",
      organizationBilling: mockData.workspace.organization.billing,
      organizationWhitelabel: null,
    });

    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: mockEnvironmentId },
      select: {
        workspace: {
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
        },
      },
    });
  });

  test("should throw ValidationError for invalid environment ID", async () => {
    const invalidId = "invalid-id";

    await expect(getEnvironmentContextForLinkSurvey(invalidId)).rejects.toThrow(ValidationError);
  });

  test("should throw ResourceNotFoundError when environment has no workspace", async () => {
    const mockEnvironmentId = "clh1a2b3c4d5e6f7g8h9m";

    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      workspace: null,
    } as any);

    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow(
      ResourceNotFoundError
    );
    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow("Workspace");
  });

  test("should throw ResourceNotFoundError when environment is not found", async () => {
    const mockEnvironmentId = "cuid123456789012345";

    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);

    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  test("should throw ResourceNotFoundError when workspace has no organization", async () => {
    const mockEnvironmentId = "clh1a2b3c4d5e6f7g8h9n";
    const mockData = {
      workspace: {
        id: "clh1a2b3c4d5e6f7g8h9o",
        name: "Test Workspace",
        styling: {},
        logo: null,
        linkSurveyBranding: true,
        organizationId: "clh1a2b3c4d5e6f7g8h9p",
        organization: null,
      },
    };

    vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockData as any);

    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow(
      ResourceNotFoundError
    );
    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow("Organization");
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const mockEnvironmentId = "clh1a2b3c4d5e6f7g8h9q";
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2025",
      clientVersion: "5.0.0",
    });

    vi.mocked(prisma.environment.findUnique).mockRejectedValue(prismaError);

    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow(DatabaseError);
    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow("Database error");
  });

  test("should rethrow non-Prisma errors", async () => {
    const mockEnvironmentId = "clh1a2b3c4d5e6f7g8h9r";
    const genericError = new Error("Generic error");

    vi.mocked(prisma.environment.findUnique).mockRejectedValue(genericError);

    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow(genericError);
  });

  test("should handle workspace with minimal data", async () => {
    const mockEnvironmentId = "clh1a2b3c4d5e6f7g8h9s";
    const mockData = {
      workspace: {
        id: "clh1a2b3c4d5e6f7g8h9t",
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
          },
          whitelabel: null,
        },
      },
    };

    vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockData as any);

    const result = await getEnvironmentContextForLinkSurvey(mockEnvironmentId);

    expect(result).toEqual({
      workspace: {
        id: "clh1a2b3c4d5e6f7g8h9t",
        name: "Minimal Workspace",
        styling: null,
        logo: null,
        linkSurveyBranding: false,
        customHeadScripts: null,
      },
      organizationId: "clh1a2b3c4d5e6f7g8h9u",
      organizationBilling: mockData.workspace.organization.billing,
      organizationWhitelabel: null,
    });
  });
});
