import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironmentStateData } from "./data";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/modules/survey/lib/utils", () => ({
  transformPrismaSurvey: vi.fn((survey) => survey),
}));

const environmentId = "cjld2cjxh0000qzrmn831i7rn";

const mockEnvironmentData = {
  id: environmentId,
  type: "production",
  appSetupCompleted: true,
  project: {
    id: "project-123",
    recontactDays: 30,
    clickOutsideClose: true,
    overlay: "none",
    placement: "bottomRight",
    inAppSurveyBranding: true,
    styling: { allowStyleOverwrite: false },
    organization: {
      id: "org-123",
      billing: {
        plan: "free",
        limits: { monthly: { responses: 100 } },
      },
    },
  },
  actionClasses: [
    {
      id: "action-1",
      type: "code",
      name: "Test Action",
      key: "test-action",
      noCodeConfig: null,
    },
  ],
  surveys: [
    {
      id: "survey-1",
      name: "Test Survey",
      type: "app",
      status: "inProgress",
      welcomeCard: { enabled: false },
      questions: [],
      blocks: null,
      variables: [],
      showLanguageSwitch: false,
      languages: [],
      endings: [],
      autoClose: null,
      styling: null,
      recaptcha: { enabled: false },
      segment: null,
      recontactDays: null,
      displayLimit: null,
      displayOption: "displayOnce",
      hiddenFields: { enabled: false },
      isBackButtonHidden: false,
      triggers: [],
      displayPercentage: null,
      delay: 0,
      projectOverwrites: null,
    },
  ],
};

describe("getEnvironmentStateData", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return environment state data when environment exists", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockEnvironmentData as never);

    const result = await getEnvironmentStateData(environmentId);

    expect(result).toEqual({
      environment: {
        id: environmentId,
        type: "production",
        appSetupCompleted: true,
        project: {
          id: "project-123",
          recontactDays: 30,
          clickOutsideClose: true,
          overlay: "none",
          placement: "bottomRight",
          inAppSurveyBranding: true,
          styling: { allowStyleOverwrite: false },
        },
      },
      organization: {
        id: "org-123",
        billing: {
          plan: "free",
          limits: { monthly: { responses: 100 } },
        },
      },
      surveys: mockEnvironmentData.surveys,
      actionClasses: mockEnvironmentData.actionClasses,
    });

    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: environmentId },
      select: expect.objectContaining({
        id: true,
        type: true,
        appSetupCompleted: true,
        project: expect.any(Object),
        actionClasses: expect.any(Object),
        surveys: expect.any(Object),
      }),
    });
  });

  test("should throw ResourceNotFoundError when environment is not found", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue(null);

    await expect(getEnvironmentStateData(environmentId)).rejects.toThrow(ResourceNotFoundError);
    await expect(getEnvironmentStateData(environmentId)).rejects.toThrow("environment");
  });

  test("should throw ResourceNotFoundError when project is not found", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      ...mockEnvironmentData,
      project: null,
    } as never);

    await expect(getEnvironmentStateData(environmentId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should throw ResourceNotFoundError when organization is not found", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      ...mockEnvironmentData,
      project: {
        ...mockEnvironmentData.project,
        organization: null,
      },
    } as never);

    await expect(getEnvironmentStateData(environmentId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should throw DatabaseError on Prisma database errors", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Connection failed", {
      code: "P2024",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.environment.findUnique).mockRejectedValue(prismaError);

    await expect(getEnvironmentStateData(environmentId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalled();
  });

  test("should rethrow unexpected errors", async () => {
    const unexpectedError = new Error("Unexpected error");
    vi.mocked(prisma.environment.findUnique).mockRejectedValue(unexpectedError);

    await expect(getEnvironmentStateData(environmentId)).rejects.toThrow("Unexpected error");
    expect(logger.error).toHaveBeenCalled();
  });

  test("should handle empty surveys array", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      ...mockEnvironmentData,
      surveys: [],
    } as never);

    const result = await getEnvironmentStateData(environmentId);

    expect(result.surveys).toEqual([]);
  });

  test("should handle empty actionClasses array", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      ...mockEnvironmentData,
      actionClasses: [],
    } as never);

    const result = await getEnvironmentStateData(environmentId);

    expect(result.actionClasses).toEqual([]);
  });

  test("should transform surveys using transformPrismaSurvey", async () => {
    const multipleSurveys = [
      ...mockEnvironmentData.surveys,
      {
        ...mockEnvironmentData.surveys[0],
        id: "survey-2",
        name: "Second Survey",
      },
    ];

    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      ...mockEnvironmentData,
      surveys: multipleSurveys,
    } as never);

    const result = await getEnvironmentStateData(environmentId);

    expect(result.surveys).toHaveLength(2);
  });

  test("should correctly map project properties to environment.project", async () => {
    const customProject = {
      ...mockEnvironmentData.project,
      recontactDays: 14,
      clickOutsideClose: false,
      overlay: "dark",
      placement: "center",
      inAppSurveyBranding: false,
      styling: { allowStyleOverwrite: true, brandColor: "#ff0000" },
    };

    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      ...mockEnvironmentData,
      project: customProject,
    } as never);

    const result = await getEnvironmentStateData(environmentId);

    expect(result.environment.project).toEqual({
      id: "project-123",
      recontactDays: 14,
      clickOutsideClose: false,
      overlay: "dark",
      placement: "center",
      inAppSurveyBranding: false,
      styling: { allowStyleOverwrite: true, brandColor: "#ff0000" },
    });
  });

  test("should validate environmentId input", async () => {
    // Invalid CUID should throw validation error
    await expect(getEnvironmentStateData("invalid-id")).rejects.toThrow();
  });

  test("should handle different environment types", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      ...mockEnvironmentData,
      type: "development",
    } as never);

    const result = await getEnvironmentStateData(environmentId);

    expect(result.environment.type).toBe("development");
  });

  test("should handle appSetupCompleted false", async () => {
    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      ...mockEnvironmentData,
      appSetupCompleted: false,
    } as never);

    const result = await getEnvironmentStateData(environmentId);

    expect(result.environment.appSetupCompleted).toBe(false);
  });

  test("should correctly extract organization billing data", async () => {
    const customBilling = {
      plan: "enterprise",
      stripeCustomerId: "cus_123",
      limits: {
        monthly: { responses: 10000, miu: 50000 },
        projects: 100,
      },
    };

    vi.mocked(prisma.environment.findUnique).mockResolvedValue({
      ...mockEnvironmentData,
      project: {
        ...mockEnvironmentData.project,
        organization: {
          id: "org-enterprise",
          billing: customBilling,
        },
      },
    } as never);

    const result = await getEnvironmentStateData(environmentId);

    expect(result.organization).toEqual({
      id: "org-enterprise",
      billing: customBilling,
    });
  });
});
