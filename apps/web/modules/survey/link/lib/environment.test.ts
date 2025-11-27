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
      project: {
        id: "clh1a2b3c4d5e6f7g8h9j",
        name: "Test Project",
        styling: { primaryColor: "#000000" },
        logo: { url: "https://example.com/logo.png" },
        linkSurveyBranding: true,
        organizationId: "clh1a2b3c4d5e6f7g8h9k",
        organization: {
          id: "clh1a2b3c4d5e6f7g8h9k",
          billing: {
            plan: "free",
            limits: {
              monthly: {
                responses: 100,
                miu: 1000,
              },
            },
            features: {
              inAppSurvey: {
                status: "active",
              },
              linkSurvey: {
                status: "active",
              },
            },
          },
        },
      },
    };

    vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockData as any);

    const result = await getEnvironmentContextForLinkSurvey(mockEnvironmentId);

    expect(result).toEqual({
      project: {
        id: "clh1a2b3c4d5e6f7g8h9j",
        name: "Test Project",
        styling: { primaryColor: "#000000" },
        logo: { url: "https://example.com/logo.png" },
        linkSurveyBranding: true,
      },
      organizationId: "clh1a2b3c4d5e6f7g8h9k",
      organizationBilling: mockData.project.organization.billing,
    });

    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: mockEnvironmentId },
      select: {
        project: {
          select: {
            id: true,
            name: true,
            styling: true,
            logo: true,
            linkSurveyBranding: true,
            organizationId: true,
            organization: {
              select: {
                id: true,
                billing: true,
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

  test("should throw ResourceNotFoundError when environment has no project", async () => {
    const mockEnvironmentId = "clh1a2b3c4d5e6f7g8h9m";

    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      project: null,
    } as any);

    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow(
      ResourceNotFoundError
    );
    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow("Project");
  });

  test("should throw ResourceNotFoundError when environment is not found", async () => {
    const mockEnvironmentId = "cuid123456789012345";

    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);

    await expect(getEnvironmentContextForLinkSurvey(mockEnvironmentId)).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  test("should throw ResourceNotFoundError when project has no organization", async () => {
    const mockEnvironmentId = "clh1a2b3c4d5e6f7g8h9n";
    const mockData = {
      project: {
        id: "clh1a2b3c4d5e6f7g8h9o",
        name: "Test Project",
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

  test("should handle project with minimal data", async () => {
    const mockEnvironmentId = "clh1a2b3c4d5e6f7g8h9s";
    const mockData = {
      project: {
        id: "clh1a2b3c4d5e6f7g8h9t",
        name: "Minimal Project",
        styling: null,
        logo: null,
        linkSurveyBranding: false,
        organizationId: "clh1a2b3c4d5e6f7g8h9u",
        organization: {
          id: "clh1a2b3c4d5e6f7g8h9u",
          billing: {
            plan: "free",
            limits: {
              monthly: {
                responses: 100,
                miu: 1000,
              },
            },
            features: {
              inAppSurvey: {
                status: "inactive",
              },
              linkSurvey: {
                status: "inactive",
              },
            },
          },
        },
      },
    };

    vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockData as any);

    const result = await getEnvironmentContextForLinkSurvey(mockEnvironmentId);

    expect(result).toEqual({
      project: {
        id: "clh1a2b3c4d5e6f7g8h9t",
        name: "Minimal Project",
        styling: null,
        logo: null,
        linkSurveyBranding: false,
      },
      organizationId: "clh1a2b3c4d5e6f7g8h9u",
      organizationBilling: mockData.project.organization.billing,
    });
  });
});
