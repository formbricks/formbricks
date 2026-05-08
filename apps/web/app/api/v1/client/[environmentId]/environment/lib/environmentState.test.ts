import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TActionClass } from "@formbricks/types/action-classes";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsEnvironmentState, TJsEnvironmentStateProject } from "@formbricks/types/js";
import { TOrganization } from "@formbricks/types/organizations";
import { TSurvey } from "@formbricks/types/surveys/types";
import { cache } from "@/lib/cache";
import { capturePostHogEvent } from "@/lib/posthog";
import { EnvironmentStateData, getEnvironmentStateData } from "./data";
import { getEnvironmentState } from "./environmentState";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));
vi.mock("@/modules/storage/utils", () => ({ resolveStorageUrlsInObject: vi.fn((obj: unknown) => obj) }));
vi.mock("@/modules/survey/lib/utils", () => ({ transformPrismaSurvey: vi.fn() }));

// Mock dependencies
vi.mock("@/lib/cache", () => ({
  cache: {
    withCache: vi.fn(),
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      update: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));
vi.mock("./data");
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
  RECAPTCHA_SITE_KEY: "mock_recaptcha_site_key",
  RECAPTCHA_SECRET_KEY: "mock_recaptcha_secret_key",
  IS_RECAPTCHA_CONFIGURED: true,
  IS_PRODUCTION: true,
  ENTERPRISE_LICENSE_KEY: "mock_enterprise_license_key",
  POSTHOG_KEY: "phc_test_key",
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

// Mock @formbricks/cache
vi.mock("@formbricks/cache", () => ({
  createCacheKey: {
    environment: {
      state: vi.fn((environmentId: string) => `fb:env:${environmentId}:state`),
    },
  },
}));

const environmentId = "test-environment-id";

const mockProject: TJsEnvironmentStateProject = {
  id: "test-project-id",
  recontactDays: 30,
  inAppSurveyBranding: true,
  placement: "bottomRight",
  clickOutsideClose: true,
  overlay: "none",
  styling: {
    allowStyleOverwrite: false,
  },
};

const mockOrganization: TOrganization = {
  id: "test-org-id",
  name: "Test Organization",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: {
    stripeCustomerId: null,
    limits: {
      projects: 1,
      monthly: {
        responses: 100,
      },
    },
    usageCycleAnchor: new Date(),
  },
  isAISmartToolsEnabled: false,
  isAIDataAnalysisEnabled: false,
};

const mockSurveys: TSurvey[] = [
  {
    id: "survey-app-inProgress",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "App Survey In Progress",
    environmentId: environmentId,
    type: "app",
    status: "inProgress",
    displayLimit: null,
    endings: [],
    followUps: [],
    isBackButtonHidden: false,
    isSingleResponsePerEmailEnabled: false,
    isVerifyEmailEnabled: false,
    projectOverwrites: null,
    showLanguageSwitch: false,
    questions: [],
    displayOption: "displayOnce",
    recontactDays: null,
    autoClose: null,
    delay: 0,
    displayPercentage: null,
    autoComplete: null,
    singleUse: null,
    triggers: [],
    languages: [],
    pin: null,
    segment: null,
    styling: null,
    surveyClosedMessage: null,
    hiddenFields: { enabled: false },
    welcomeCard: { enabled: false, showResponseCount: false, timeToFinish: false },
    variables: [],
    createdBy: null,
    recaptcha: { enabled: false, threshold: 0.5 },
  } as unknown as TSurvey,
];

const mockActionClasses: TActionClass[] = [
  {
    id: "action-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Action 1",
    description: null,
    type: "code",
    noCodeConfig: null,
    environmentId: environmentId,
    key: "action1",
  },
];

const mockEnvironmentStateData: EnvironmentStateData = {
  environment: {
    id: environmentId,
    type: "production",
    appSetupCompleted: true,
    project: mockProject,
  },
  organization: {
    id: mockOrganization.id,
    billing: mockOrganization.billing,
  },
  surveys: mockSurveys,
  actionClasses: mockActionClasses,
};

describe("getEnvironmentState", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock cache.withCache to simply execute the function without caching for tests
    vi.mocked(cache.withCache).mockImplementation(async (fn) => await fn());

    // Default mocks for successful retrieval
    vi.mocked(getEnvironmentStateData).mockResolvedValue(mockEnvironmentStateData);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({ organizationId: "test-org-id" });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return the correct environment state", async () => {
    const result = await getEnvironmentState(environmentId);

    const expectedData: TJsEnvironmentState["data"] = {
      recaptchaSiteKey: "mock_recaptcha_site_key",
      surveys: mockSurveys,
      actionClasses: mockActionClasses,
      project: mockProject,
    };

    expect(result.data).toEqual(expectedData);
    expect(getEnvironmentStateData).toHaveBeenCalledWith(environmentId);
    expect(prisma.environment.update).not.toHaveBeenCalled();
  });

  test("should throw ResourceNotFoundError if environment not found", async () => {
    vi.mocked(getEnvironmentStateData).mockRejectedValue(
      new ResourceNotFoundError("environment", environmentId)
    );
    await expect(getEnvironmentState(environmentId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should throw ResourceNotFoundError if organization not found", async () => {
    vi.mocked(getEnvironmentStateData).mockRejectedValue(new ResourceNotFoundError("organization", null));
    await expect(getEnvironmentState(environmentId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should throw ResourceNotFoundError if project not found", async () => {
    vi.mocked(getEnvironmentStateData).mockRejectedValue(new ResourceNotFoundError("project", null));
    await expect(getEnvironmentState(environmentId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should update environment and capture event if app setup not completed", async () => {
    const incompleteEnvironmentData = {
      ...mockEnvironmentStateData,
      environment: {
        ...mockEnvironmentStateData.environment,
        appSetupCompleted: false,
      },
    };
    vi.mocked(getEnvironmentStateData).mockResolvedValue(incompleteEnvironmentData);

    const result = await getEnvironmentState(environmentId);

    expect(prisma.environment.update).toHaveBeenCalledWith({
      where: { id: environmentId },
      data: { appSetupCompleted: true },
    });
    expect(result.data).toBeDefined();
  });

  test("should include recaptchaSiteKey if recaptcha variables are set", async () => {
    const result = await getEnvironmentState(environmentId);

    expect(result.data.recaptchaSiteKey).toBe("mock_recaptcha_site_key");
  });

  test("should use cache.withCache for caching with correct cache key and TTL", () => {
    getEnvironmentState(environmentId);

    expect(cache.withCache).toHaveBeenCalledWith(
      expect.any(Function),
      "fb:env:test-environment-id:state",
      60 * 1000 // 1 minutes in milliseconds
    );
  });

  test("should propagate database update errors", async () => {
    const incompleteEnvironmentData = {
      ...mockEnvironmentStateData,
      environment: {
        ...mockEnvironmentStateData.environment,
        appSetupCompleted: false,
      },
    };
    vi.mocked(getEnvironmentStateData).mockResolvedValue(incompleteEnvironmentData);
    vi.mocked(prisma.environment.update).mockRejectedValue(new Error("Database error"));

    // Should throw error since Promise.all will fail if database update fails
    await expect(getEnvironmentState(environmentId)).rejects.toThrow("Database error");
  });

  test("should include recaptchaSiteKey when IS_RECAPTCHA_CONFIGURED is true", async () => {
    const result = await getEnvironmentState(environmentId);

    expect(result.data).toHaveProperty("recaptchaSiteKey");
    expect(result.data.recaptchaSiteKey).toBe("mock_recaptcha_site_key");
  });

  test("should handle different survey types and statuses", async () => {
    const mixedSurveys = [
      ...mockSurveys,
      {
        ...mockSurveys[0],
        id: "survey-web-draft",
        type: "app", // Use valid survey type
        status: "draft",
      } as TSurvey,
      {
        ...mockSurveys[0],
        id: "survey-link-completed",
        type: "link",
        status: "completed",
      } as TSurvey,
    ];

    const modifiedData = {
      ...mockEnvironmentStateData,
      surveys: mixedSurveys,
    };
    vi.mocked(getEnvironmentStateData).mockResolvedValue(modifiedData);

    const result = await getEnvironmentState(environmentId);

    expect(result.data.surveys).toEqual(mixedSurveys);
  });

  test("should handle empty surveys array", async () => {
    const emptyData = {
      ...mockEnvironmentStateData,
      surveys: [],
    };
    vi.mocked(getEnvironmentStateData).mockResolvedValue(emptyData);

    const result = await getEnvironmentState(environmentId);

    expect(result.data.surveys).toEqual([]);
  });

  test("should handle empty actionClasses array", async () => {
    const emptyData = {
      ...mockEnvironmentStateData,
      actionClasses: [],
    };
    vi.mocked(getEnvironmentStateData).mockResolvedValue(emptyData);

    const result = await getEnvironmentState(environmentId);

    expect(result.data.actionClasses).toEqual([]);
  });

  test("should capture app_connected PostHog event when app setup completes", async () => {
    const noCodeAction = {
      ...mockActionClasses[0],
      id: "action-2",
      type: "noCode" as const,
      key: null,
    };
    const incompleteEnvironmentData = {
      ...mockEnvironmentStateData,
      environment: {
        ...mockEnvironmentStateData.environment,
        appSetupCompleted: false,
      },
      actionClasses: [...mockActionClasses, noCodeAction],
    };
    vi.mocked(getEnvironmentStateData).mockResolvedValue(incompleteEnvironmentData);

    await getEnvironmentState(environmentId);

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      environmentId,
      "app_connected",
      {
        num_surveys: 1,
        num_code_actions: 1,
        num_no_code_actions: 1,
        organization_id: "test-org-id",
        workspace_id: "test-project-id",
      },
      { organizationId: "test-org-id", workspaceId: "test-project-id" }
    );
  });

  test("should not capture app_connected event when app setup already completed", async () => {
    vi.mocked(getEnvironmentStateData).mockResolvedValue(mockEnvironmentStateData);

    await getEnvironmentState(environmentId);

    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });
});
