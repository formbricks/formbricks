import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TActionClass } from "@formbricks/types/action-classes";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsWorkspaceStateWorkspaceSetting } from "@formbricks/types/js";
import { TSurvey } from "@formbricks/types/surveys/types";
import { cache } from "@/lib/cache";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { WorkspaceStateData, getWorkspaceStateData } from "./data";
import { getWorkspaceState } from "./environmentState";

vi.mock("server-only", () => ({}));

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
    workspace: {
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
vi.mock("@/app/lib/api/api-backwards-compat", () => ({
  addLegacyProjectOverwritesToList: vi.fn((surveys: unknown[]) =>
    surveys.map((survey) => {
      const typedSurvey = survey as Record<string, unknown>;
      return {
        ...typedSurvey,
        projectOverwrites: typedSurvey.workspaceOverwrites ?? null,
      };
    })
  ),
  addLegacyProjectToEnvironmentState: vi.fn((data: Record<string, unknown>) => ({
    ...data,
    project: data.workspace,
  })),
}));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));
vi.mock("@/modules/storage/utils", () => ({ resolveStorageUrlsInObject: vi.fn((o: unknown) => o) }));
vi.mock("@/modules/survey/lib/utils", () => ({ transformPrismaSurvey: vi.fn((s: unknown) => s) }));
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

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn().mockResolvedValue("mock-org-id"),
}));

// Mock @formbricks/cache
vi.mock("@formbricks/cache", () => ({
  createCacheKey: {
    workspace: {
      state: vi.fn((workspaceId: string) => `fb:env:${workspaceId}:state`),
    },
  },
}));

const workspaceId = "test-workspace-id";

const mockWorkspace: TJsWorkspaceStateWorkspaceSetting = {
  recontactDays: 30,
  inAppSurveyBranding: true,
  placement: "bottomRight",
  clickOutsideClose: true,
  overlay: "none",
  styling: {
    allowStyleOverwrite: false,
  },
};

const mockSurveys: TSurvey[] = [
  {
    id: "survey-app-inProgress",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "App Survey In Progress",
    type: "app",
    status: "inProgress",
    displayLimit: null,
    endings: [],
    followUps: [],
    isBackButtonHidden: false,
    isSingleResponsePerEmailEnabled: false,
    isVerifyEmailEnabled: false,
    workspaceOverwrites: null,
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

const mockActionClasses = [
  {
    id: "action-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Action 1",
    description: null,
    type: "code",
    noCodeConfig: null,
    workspaceId,
    key: "action1",
  },
] as unknown as TActionClass[];

const mockWorkspaceStateData: WorkspaceStateData = {
  workspace: {
    id: workspaceId,
    appSetupCompleted: true,
    workspaceSettings: mockWorkspace,
  },
  surveys: mockSurveys,
  actionClasses: mockActionClasses,
};

describe("getWorkspaceState", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock cache.withCache to simply execute the function without caching for tests
    vi.mocked(cache.withCache).mockImplementation(async (fn) => await fn());

    // Default mocks for successful retrieval
    vi.mocked(getWorkspaceStateData).mockResolvedValue(mockWorkspaceStateData);
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("mock-org-id");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return the correct environment state", async () => {
    const result = await getWorkspaceState(workspaceId);

    // Backwards compat: response includes `project` alongside `workspace`,
    // and each survey includes `projectOverwrites` alongside `workspaceOverwrites`
    const surveysWithLegacy = mockSurveys.map((s) => ({
      ...s,
      projectOverwrites: (s as Record<string, unknown>).workspaceOverwrites ?? null,
    }));

    const expectedData = {
      recaptchaSiteKey: "mock_recaptcha_site_key",
      surveys: surveysWithLegacy,
      actionClasses: mockActionClasses,
      workspace: mockWorkspace,
      project: mockWorkspace,
    };

    expect(result.data).toEqual(expectedData);
    expect(getWorkspaceStateData).toHaveBeenCalledWith(workspaceId);
    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });

  test("should throw ResourceNotFoundError if workspace not found", async () => {
    vi.mocked(getWorkspaceStateData).mockRejectedValue(new ResourceNotFoundError("workspace", workspaceId));
    await expect(getWorkspaceState(workspaceId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should throw ResourceNotFoundError if organization not found", async () => {
    vi.mocked(getWorkspaceStateData).mockRejectedValue(new ResourceNotFoundError("organization", null));
    await expect(getWorkspaceState(workspaceId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should update workspace when app setup not completed", async () => {
    const incompleteData = {
      ...mockWorkspaceStateData,
      workspace: {
        ...mockWorkspaceStateData.workspace,
        appSetupCompleted: false,
      },
    };
    vi.mocked(getWorkspaceStateData).mockResolvedValue(incompleteData);

    const result = await getWorkspaceState(workspaceId);

    expect(prisma.workspace.update).toHaveBeenCalledWith({
      where: { id: workspaceId },
      data: { appSetupCompleted: true },
    });
    expect(result.data).toBeDefined();
  });

  test("should include recaptchaSiteKey if recaptcha variables are set", async () => {
    const result = await getWorkspaceState(workspaceId);

    expect(result.data.recaptchaSiteKey).toBe("mock_recaptcha_site_key");
  });

  test("should use cache.withCache for caching with correct cache key and TTL", () => {
    getWorkspaceState(workspaceId);

    expect(cache.withCache).toHaveBeenCalledWith(
      expect.any(Function),
      `fb:env:${workspaceId}:state`,
      60 * 1000 // 1 minutes in milliseconds
    );
  });

  test("should propagate database update errors", async () => {
    const incompleteData = {
      ...mockWorkspaceStateData,
      workspace: {
        ...mockWorkspaceStateData.workspace,
        appSetupCompleted: false,
      },
    };
    vi.mocked(getWorkspaceStateData).mockResolvedValue(incompleteData);
    vi.mocked(prisma.workspace.update).mockRejectedValue(new Error("Database error"));

    // Should throw error since Promise.all will fail if database update fails
    await expect(getWorkspaceState(workspaceId)).rejects.toThrow("Database error");
  });

  test("should include recaptchaSiteKey when IS_RECAPTCHA_CONFIGURED is true", async () => {
    const result = await getWorkspaceState(workspaceId);

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
      ...mockWorkspaceStateData,
      surveys: mixedSurveys,
    };
    vi.mocked(getWorkspaceStateData).mockResolvedValue(modifiedData);

    const result = await getWorkspaceState(workspaceId);

    // Backwards compat: each survey includes `projectOverwrites`
    const expectedSurveys = mixedSurveys.map((s) => ({
      ...s,
      projectOverwrites: (s as Record<string, unknown>).workspaceOverwrites ?? null,
    }));
    expect(result.data.surveys).toEqual(expectedSurveys);
  });

  test("should handle empty surveys array", async () => {
    const emptyData = {
      ...mockWorkspaceStateData,
      surveys: [],
    };
    vi.mocked(getWorkspaceStateData).mockResolvedValue(emptyData);

    const result = await getWorkspaceState(workspaceId);

    expect(result.data.surveys).toEqual([]);
  });

  test("should handle empty actionClasses array", async () => {
    const emptyData = {
      ...mockWorkspaceStateData,
      actionClasses: [],
    };
    vi.mocked(getWorkspaceStateData).mockResolvedValue(emptyData);

    const result = await getWorkspaceState(workspaceId);

    expect(result.data.actionClasses).toEqual([]);
  });

  test("should capture app_connected PostHog event when app setup completes", async () => {
    const noCodeAction = {
      ...mockActionClasses[0],
      id: "action-2",
      type: "noCode" as const,
      key: null,
    };
    const incompleteWorkspaceData = {
      ...mockWorkspaceStateData,
      workspace: {
        ...mockWorkspaceStateData.workspace,
        appSetupCompleted: false,
      },
      actionClasses: [...mockActionClasses, noCodeAction],
    };
    vi.mocked(getWorkspaceStateData).mockResolvedValue(incompleteWorkspaceData);

    await getWorkspaceState(workspaceId);

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      workspaceId,
      "app_connected",
      {
        num_surveys: 1,
        num_code_actions: 1,
        num_no_code_actions: 1,
        organization_id: "mock-org-id",
        workspace_id: workspaceId,
      },
      { organizationId: "mock-org-id", workspaceId }
    );
  });

  test("should not capture app_connected event when app setup already completed", async () => {
    vi.mocked(getWorkspaceStateData).mockResolvedValue(mockWorkspaceStateData);

    await getWorkspaceState(workspaceId);

    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });
});
