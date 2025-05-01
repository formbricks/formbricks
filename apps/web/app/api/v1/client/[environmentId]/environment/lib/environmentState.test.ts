import { cache } from "@/lib/cache";
import { getEnvironment } from "@/lib/environment/service";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@/lib/organization/service";
import {
  capturePosthogEnvironmentEvent,
  sendPlanLimitsReachedEventToPosthogWeekly,
} from "@/lib/posthogServer";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsEnvironmentState } from "@formbricks/types/js";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getActionClassesForEnvironmentState } from "./actionClass";
import { getEnvironmentState } from "./environmentState";
import { getProjectForEnvironmentState } from "./project";
import { getSurveysForEnvironmentState } from "./survey";

// Mock dependencies
vi.mock("@/lib/cache");
vi.mock("@/lib/environment/service");
vi.mock("@/lib/organization/service");
vi.mock("@/lib/posthogServer");
vi.mock("@/modules/ee/license-check/lib/utils");
vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      update: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));
vi.mock("./actionClass");
vi.mock("./project");
vi.mock("./survey");
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true, // Default to false, override in specific tests
  RECAPTCHA_SITE_KEY: "mock_recaptcha_site_key",
  IS_PRODUCTION: true,
  IS_POSTHOG_CONFIGURED: false,
  ENTERPRISE_LICENSE_KEY: "mock_enterprise_license_key",
}));

const environmentId = "test-environment-id";

const mockEnvironment: TEnvironment = {
  id: environmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  projectId: "test-project-id",
  type: "production",
  appSetupCompleted: true, // Default to true
};

const mockOrganization: TOrganization = {
  id: "test-org-id",
  name: "Test Organization",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: {
    plan: "free",
    stripeCustomerId: null,
    period: "monthly",
    limits: {
      projects: 1,
      monthly: {
        responses: 100, // Default limit
        miu: 1000,
      },
    },
    periodStart: new Date(),
  },
  isAIEnabled: false,
};

const mockProject: TProject = {
  id: "test-project-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Project",
  config: {
    channel: "link",
    industry: "eCommerce",
  },
  organizationId: mockOrganization.id,
  styling: {
    allowStyleOverwrite: false,
  },
  recontactDays: 30,
  inAppSurveyBranding: true,
  linkSurveyBranding: true,
  placement: "bottomRight",
  clickOutsideClose: true,
  darkOverlay: false,
  environments: [],
  languages: [],
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
    runOnDate: null,
    showLanguageSwitch: false,
    questions: [],
    displayOption: "displayOnce",
    recontactDays: null,
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayPercentage: null,
    autoComplete: null,
    singleUse: null,
    triggers: [],
    languages: [],
    pin: null,
    resultShareKey: null,
    segment: null,
    styling: null,
    surveyClosedMessage: null,
    hiddenFields: { enabled: false },
    welcomeCard: { enabled: false, showResponseCount: false, timeToFinish: false },
    variables: [],
    createdBy: null,
    recaptcha: { enabled: false, threshold: 0.5 },
  },
  {
    id: "survey-app-paused",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "App Survey Paused",
    environmentId: environmentId,
    displayLimit: null,
    endings: [],
    followUps: [],
    isBackButtonHidden: false,
    isSingleResponsePerEmailEnabled: false,
    isVerifyEmailEnabled: false,
    projectOverwrites: null,
    runOnDate: null,
    showLanguageSwitch: false,
    type: "app",
    status: "paused",
    questions: [],
    displayOption: "displayOnce",
    recontactDays: null,
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayPercentage: null,
    autoComplete: null,
    singleUse: null,
    triggers: [],
    languages: [],
    pin: null,
    resultShareKey: null,
    segment: null,
    styling: null,
    surveyClosedMessage: null,
    hiddenFields: { enabled: false },
    welcomeCard: { enabled: false, showResponseCount: false, timeToFinish: false },
    variables: [],
    createdBy: null,
    recaptcha: { enabled: false, threshold: 0.5 },
  },
  {
    id: "survey-web-inProgress",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Web Survey In Progress",
    environmentId: environmentId,
    type: "link",
    displayLimit: null,
    endings: [],
    followUps: [],
    isBackButtonHidden: false,
    isSingleResponsePerEmailEnabled: false,
    isVerifyEmailEnabled: false,
    projectOverwrites: null,
    runOnDate: null,
    showLanguageSwitch: false,
    status: "inProgress",
    questions: [],
    displayOption: "displayOnce",
    recontactDays: null,
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayPercentage: null,
    autoComplete: null,
    singleUse: null,
    triggers: [],
    languages: [],
    pin: null,
    resultShareKey: null,
    segment: null,
    styling: null,
    surveyClosedMessage: null,
    hiddenFields: { enabled: false },
    welcomeCard: { enabled: false, showResponseCount: false, timeToFinish: false },
    variables: [],
    createdBy: null,
    recaptcha: { enabled: false, threshold: 0.5 },
  },
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

describe("getEnvironmentState", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock the cache implementation
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
    // Default mocks for successful retrieval
    vi.mocked(getEnvironment).mockResolvedValue(mockEnvironment);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization);
    vi.mocked(getProjectForEnvironmentState).mockResolvedValue(mockProject);
    vi.mocked(getSurveysForEnvironmentState).mockResolvedValue(mockSurveys);
    vi.mocked(getActionClassesForEnvironmentState).mockResolvedValue(mockActionClasses);
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false); // Default to false
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(50); // Default below limit
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return the correct environment state", async () => {
    const result = await getEnvironmentState(environmentId);

    const expectedData: TJsEnvironmentState["data"] = {
      surveys: [mockSurveys[0]], // Only app, inProgress survey
      actionClasses: mockActionClasses,
      project: mockProject,
    };

    expect(result.data).toEqual(expectedData);
    expect(result.revalidateEnvironment).toBe(false);
    expect(getEnvironment).toHaveBeenCalledWith(environmentId);
    expect(getOrganizationByEnvironmentId).toHaveBeenCalledWith(environmentId);
    expect(getProjectForEnvironmentState).toHaveBeenCalledWith(environmentId);
    expect(getSurveysForEnvironmentState).toHaveBeenCalledWith(environmentId);
    expect(getActionClassesForEnvironmentState).toHaveBeenCalledWith(environmentId);
    expect(getIsSpamProtectionEnabled).toHaveBeenCalled();
    expect(prisma.environment.update).not.toHaveBeenCalled();
    expect(capturePosthogEnvironmentEvent).not.toHaveBeenCalled();
    expect(getMonthlyOrganizationResponseCount).toHaveBeenCalled(); // Not cloud
    expect(sendPlanLimitsReachedEventToPosthogWeekly).not.toHaveBeenCalled();
  });

  test("should throw ResourceNotFoundError if environment not found", async () => {
    vi.mocked(getEnvironment).mockResolvedValue(null);
    await expect(getEnvironmentState(environmentId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should throw ResourceNotFoundError if organization not found", async () => {
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(null);
    await expect(getEnvironmentState(environmentId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should throw ResourceNotFoundError if project not found", async () => {
    vi.mocked(getProjectForEnvironmentState).mockResolvedValue(null);
    await expect(getEnvironmentState(environmentId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should update environment and capture event if app setup not completed", async () => {
    const incompleteEnv = { ...mockEnvironment, appSetupCompleted: false };
    vi.mocked(getEnvironment).mockResolvedValue(incompleteEnv);

    const result = await getEnvironmentState(environmentId);

    expect(prisma.environment.update).toHaveBeenCalledWith({
      where: { id: environmentId },
      data: { appSetupCompleted: true },
    });
    expect(capturePosthogEnvironmentEvent).toHaveBeenCalledWith(environmentId, "app setup completed");
    expect(result.revalidateEnvironment).toBe(true);
  });

  test("should return empty surveys if monthly response limit reached (Cloud)", async () => {
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(100); // Exactly at limit
    vi.mocked(getSurveysForEnvironmentState).mockResolvedValue(mockSurveys);

    const result = await getEnvironmentState(environmentId);
    expect(result.data.surveys).toEqual([]);
    expect(getMonthlyOrganizationResponseCount).toHaveBeenCalledWith(mockOrganization.id);
    expect(sendPlanLimitsReachedEventToPosthogWeekly).toHaveBeenCalledWith(environmentId, {
      plan: mockOrganization.billing.plan,
      limits: {
        projects: null,
        monthly: {
          miu: null,
          responses: mockOrganization.billing.limits.monthly.responses,
        },
      },
    });
  });

  test("should return surveys if monthly response limit not reached (Cloud)", async () => {
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(99); // Below limit

    const result = await getEnvironmentState(environmentId);

    expect(result.data.surveys).toEqual([mockSurveys[0]]);
    expect(getMonthlyOrganizationResponseCount).toHaveBeenCalledWith(mockOrganization.id);
    expect(sendPlanLimitsReachedEventToPosthogWeekly).not.toHaveBeenCalled();
  });

  test("should handle error when sending Posthog limit reached event", async () => {
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(100);
    const posthogError = new Error("Posthog failed");
    vi.mocked(sendPlanLimitsReachedEventToPosthogWeekly).mockRejectedValue(posthogError);

    const result = await getEnvironmentState(environmentId);

    expect(result.data.surveys).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      posthogError,
      "Error sending plan limits reached event to Posthog"
    );
  });

  test("should include recaptchaSiteKey if spam protection is enabled", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);

    const result = await getEnvironmentState(environmentId);

    expect(result.data.recaptchaSiteKey).toBe("mock_recaptcha_site_key");
  });

  test("should not include recaptchaSiteKey if spam protection is disabled", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false);

    const result = await getEnvironmentState(environmentId);

    expect(result.data.recaptchaSiteKey).toBeUndefined();
  });

  test("should filter surveys correctly (only app type and inProgress status)", async () => {
    const result = await getEnvironmentState(environmentId);
    expect(result.data.surveys).toHaveLength(1);
    expect(result.data.surveys[0].id).toBe("survey-app-inProgress");
  });
});
