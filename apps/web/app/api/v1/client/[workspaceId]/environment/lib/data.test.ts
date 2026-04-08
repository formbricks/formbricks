import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironmentStateData } from "./data";

vi.mock("server-only", () => ({}));

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: vi.fn((obj) => obj),
}));

vi.mock("@/modules/survey/lib/utils", () => ({
  transformPrismaSurvey: vi.fn((survey) => survey),
}));

const workspaceId = "cjld2cjxh0000qzrmn831i7rn";

const mockWorkspaceData = {
  id: workspaceId,
  appSetupCompleted: true,
  recontactDays: 30,
  clickOutsideClose: true,
  overlay: "none",
  placement: "bottomRight",
  inAppSurveyBranding: true,
  styling: { allowStyleOverwrite: false },
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
      workspaceOverwrites: null,
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

  test("should return environment state data when workspace exists", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspaceData as never);

    const result = await getEnvironmentStateData(workspaceId);

    expect(result).toEqual({
      workspace: {
        id: workspaceId,
        appSetupCompleted: true,
        workspaceSettings: {
          id: workspaceId,
          recontactDays: 30,
          clickOutsideClose: true,
          overlay: "none",
          placement: "bottomRight",
          inAppSurveyBranding: true,
          styling: { allowStyleOverwrite: false },
        },
      },
      surveys: mockWorkspaceData.surveys,
      actionClasses: mockWorkspaceData.actionClasses,
    });

    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: workspaceId },
      select: expect.objectContaining({
        id: true,
        appSetupCompleted: true,
        recontactDays: true,
        actionClasses: expect.any(Object),
        surveys: expect.any(Object),
      }),
    });
  });

  test("should throw ResourceNotFoundError when workspace is not found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    await expect(getEnvironmentStateData(workspaceId)).rejects.toThrow(ResourceNotFoundError);
    await expect(getEnvironmentStateData(workspaceId)).rejects.toThrow("workspace");
  });

  test("should throw DatabaseError on Prisma database errors", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Connection failed", {
      code: "P2024",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(prismaError);

    await expect(getEnvironmentStateData(workspaceId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalled();
  });

  test("should rethrow unexpected errors", async () => {
    const unexpectedError = new Error("Unexpected error");
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(unexpectedError);

    await expect(getEnvironmentStateData(workspaceId)).rejects.toThrow("Unexpected error");
    expect(logger.error).toHaveBeenCalled();
  });

  test("should handle empty surveys array", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: [],
    } as never);

    const result = await getEnvironmentStateData(workspaceId);

    expect(result.surveys).toEqual([]);
  });

  test("should handle empty actionClasses array", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      actionClasses: [],
    } as never);

    const result = await getEnvironmentStateData(workspaceId);

    expect(result.actionClasses).toEqual([]);
  });

  test("should transform surveys using transformPrismaSurvey", async () => {
    const multipleSurveys = [
      ...mockWorkspaceData.surveys,
      {
        ...mockWorkspaceData.surveys[0],
        id: "survey-2",
        name: "Second Survey",
      },
    ];

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: multipleSurveys,
    } as never);

    const result = await getEnvironmentStateData(workspaceId);

    expect(result.surveys).toHaveLength(2);
  });

  test("should correctly map workspace properties to workspaceSettings", async () => {
    const customWorkspace = {
      ...mockWorkspaceData,
      recontactDays: 14,
      clickOutsideClose: false,
      overlay: "dark",
      placement: "center",
      inAppSurveyBranding: false,
      styling: { allowStyleOverwrite: true, brandColor: "#ff0000" },
    };

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(customWorkspace as never);

    const result = await getEnvironmentStateData(workspaceId);

    expect(result.workspace.workspaceSettings).toEqual({
      id: workspaceId,
      recontactDays: 14,
      clickOutsideClose: false,
      overlay: "dark",
      placement: "center",
      inAppSurveyBranding: false,
      styling: { allowStyleOverwrite: true, brandColor: "#ff0000" },
    });
  });

  test("should validate workspaceId input", async () => {
    // Invalid CUID should throw validation error
    await expect(getEnvironmentStateData("invalid-id")).rejects.toThrow();
  });

  test("should handle appSetupCompleted false", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      appSetupCompleted: false,
    } as never);

    const result = await getEnvironmentStateData(workspaceId);

    expect(result.workspace.appSetupCompleted).toBe(false);
  });

  test("should not include organization in result", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspaceData as never);

    const result = await getEnvironmentStateData(workspaceId);

    expect(result).not.toHaveProperty("organization");
  });
});
