import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createI18nString } from "@/lib/i18n/utils";
import { checkExternalUrlsPermission } from "./check-external-urls-permission";

vi.mock("@/modules/survey/lib/survey", () => ({
  getOrganizationBilling: vi.fn(),
}));

vi.mock("@/modules/survey/lib/permission", () => ({
  getExternalUrlsPermission: vi.fn(),
}));

const { getOrganizationBilling } = await import("@/modules/survey/lib/survey");
const { getExternalUrlsPermission } = await import("@/modules/survey/lib/permission");

describe("checkExternalUrlsPermission", () => {
  const mockOrganizationId = "org123";
  const baseSurvey: TSurvey = {
    id: "survey123",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test Survey",
    type: "link",
    environmentId: "env123",
    createdBy: "user123",
    status: "draft",
    displayOption: "displayOnce",
    blocks: [],
    endings: [],
    hiddenFields: { enabled: false },
    delay: 0,
    autoComplete: null,
    projectOverwrites: null,
    styling: null,
    showLanguageSwitch: false,
    segment: null,
    surveyClosedMessage: null,
    singleUse: null,
    isVerifyEmailEnabled: false,
    recaptcha: null,
    isSingleResponsePerEmailEnabled: false,
    isBackButtonHidden: false,
    pin: null,
    displayPercentage: null,
    languages: [],
    variables: [],
    followUps: [],
    welcomeCard: {
      enabled: false,
      timeToFinish: true,
      showResponseCount: false,
    },
    triggers: [],
    metadata: {},
  } as unknown as TSurvey;

  const mockOrganizationBilling = {
    id: mockOrganizationId,
    plan: "free",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should throw ResourceNotFoundError when organization billing is not found", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(null);

    await expect(checkExternalUrlsPermission(mockOrganizationId, baseSurvey, null)).rejects.toThrow(
      ResourceNotFoundError
    );
    expect(getOrganizationBilling).toHaveBeenCalledWith(mockOrganizationId);
  });

  test("should allow external URLs when permission is granted", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);

    const surveyWithExternalUrl: TSurvey = {
      ...baseSurvey,
      endings: [
        {
          id: "end1",
          type: "endScreen",
          headline: createI18nString("Thank you", ["en"]),
          buttonLink: "https://example.com",
        },
      ],
    };

    await expect(
      checkExternalUrlsPermission(mockOrganizationId, surveyWithExternalUrl, null)
    ).resolves.not.toThrow();
  });

  test("should throw OperationNotAllowedError for new ending card button link without permission", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    const surveyWithNewButtonLink: TSurvey = {
      ...baseSurvey,
      endings: [
        {
          id: "end1",
          type: "endScreen",
          headline: createI18nString("Thank you", ["en"]),
          buttonLink: "https://example.com",
        },
      ],
    };

    await expect(
      checkExternalUrlsPermission(mockOrganizationId, surveyWithNewButtonLink, null)
    ).rejects.toThrow(OperationNotAllowedError);
    await expect(
      checkExternalUrlsPermission(mockOrganizationId, surveyWithNewButtonLink, null)
    ).rejects.toThrow("External URLs are not enabled for this organization");
  });

  test("should allow unchanged ending card button link (grandfathering)", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    const oldSurvey: TSurvey = {
      ...baseSurvey,
      endings: [
        {
          id: "end1",
          type: "endScreen",
          headline: createI18nString("Thank you", ["en"]),
          buttonLink: "https://example.com",
        },
      ],
    };

    const newSurvey: TSurvey = {
      ...baseSurvey,
      endings: [
        {
          id: "end1",
          type: "endScreen",
          headline: createI18nString("Thank you very much", ["en"]),
          buttonLink: "https://example.com",
        },
      ],
    };

    await expect(
      checkExternalUrlsPermission(mockOrganizationId, newSurvey, oldSurvey)
    ).resolves.not.toThrow();
  });

  test("should throw OperationNotAllowedError for changed ending card button link without permission", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    const oldSurvey: TSurvey = {
      ...baseSurvey,
      endings: [
        {
          id: "end1",
          type: "endScreen",
          headline: createI18nString("Thank you", ["en"]),
          buttonLink: "https://example.com",
        },
      ],
    };

    const newSurvey: TSurvey = {
      ...baseSurvey,
      endings: [
        {
          id: "end1",
          type: "endScreen",
          headline: createI18nString("Thank you", ["en"]),
          buttonLink: "https://different-url.com",
        },
      ],
    };

    await expect(checkExternalUrlsPermission(mockOrganizationId, newSurvey, oldSurvey)).rejects.toThrow(
      OperationNotAllowedError
    );
  });

  test("should allow ending card without button link", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    const surveyWithoutButtonLink: TSurvey = {
      ...baseSurvey,
      endings: [
        {
          id: "end1",
          type: "endScreen",
          headline: createI18nString("Thank you", ["en"]),
        },
      ],
    };

    await expect(
      checkExternalUrlsPermission(mockOrganizationId, surveyWithoutButtonLink, null)
    ).resolves.not.toThrow();
  });

  test("should throw OperationNotAllowedError for new external CTA button without permission", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    const surveyWithExternalCTA: TSurvey = {
      ...baseSurvey,
      blocks: [
        {
          id: "block1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.CTA,
              headline: createI18nString("Click here", ["en"]),
              buttonLabel: createI18nString("Visit", ["en"]),
              buttonExternal: true,
              buttonUrl: "https://example.com",
              required: false,
            },
          ],
        },
      ],
    };

    await expect(
      checkExternalUrlsPermission(mockOrganizationId, surveyWithExternalCTA, null)
    ).rejects.toThrow(OperationNotAllowedError);
    await expect(
      checkExternalUrlsPermission(mockOrganizationId, surveyWithExternalCTA, null)
    ).rejects.toThrow("External URLs are not enabled for this organization");
  });

  test("should allow unchanged external CTA button (grandfathering)", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    const oldSurvey: TSurvey = {
      ...baseSurvey,
      blocks: [
        {
          id: "block1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.CTA,
              headline: createI18nString("Click here", ["en"]),
              buttonLabel: createI18nString("Visit", ["en"]),
              buttonExternal: true,
              buttonUrl: "https://example.com",
              required: false,
            },
          ],
        },
      ],
    };

    const newSurvey: TSurvey = {
      ...baseSurvey,
      blocks: [
        {
          id: "block1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.CTA,
              headline: createI18nString("Click here now", ["en"]),
              buttonLabel: createI18nString("Visit", ["en"]),
              buttonExternal: true,
              buttonUrl: "https://example.com",
              required: false,
            },
          ],
        },
      ],
    };

    await expect(
      checkExternalUrlsPermission(mockOrganizationId, newSurvey, oldSurvey)
    ).resolves.not.toThrow();
  });

  test("should throw OperationNotAllowedError when switching CTA button to external without permission", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    const oldSurvey: TSurvey = {
      ...baseSurvey,
      blocks: [
        {
          id: "block1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.CTA,
              headline: createI18nString("Click here", ["en"]),
              buttonLabel: createI18nString("Visit", ["en"]),
              buttonExternal: false,
              buttonUrl: "",
              required: false,
            },
          ],
        },
      ],
    };

    const newSurvey: TSurvey = {
      ...baseSurvey,
      blocks: [
        {
          id: "block1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.CTA,
              headline: createI18nString("Click here", ["en"]),
              buttonLabel: createI18nString("Visit", ["en"]),
              buttonExternal: true,
              buttonUrl: "https://example.com",
              required: false,
            },
          ],
        },
      ],
    };

    await expect(checkExternalUrlsPermission(mockOrganizationId, newSurvey, oldSurvey)).rejects.toThrow(
      OperationNotAllowedError
    );
  });

  test("should throw OperationNotAllowedError when changing external CTA button URL without permission", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    const oldSurvey: TSurvey = {
      ...baseSurvey,
      blocks: [
        {
          id: "block1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.CTA,
              headline: createI18nString("Click here", ["en"]),
              buttonLabel: createI18nString("Visit", ["en"]),
              buttonExternal: true,
              buttonUrl: "https://example.com",
              required: false,
            },
          ],
        },
      ],
    };

    const newSurvey: TSurvey = {
      ...baseSurvey,
      blocks: [
        {
          id: "block1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.CTA,
              headline: createI18nString("Click here", ["en"]),
              buttonLabel: createI18nString("Visit", ["en"]),
              buttonExternal: true,
              buttonUrl: "https://different-url.com",
              required: false,
            },
          ],
        },
      ],
    };

    await expect(checkExternalUrlsPermission(mockOrganizationId, newSurvey, oldSurvey)).rejects.toThrow(
      OperationNotAllowedError
    );
  });

  test("should allow internal CTA button without permission", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    const surveyWithInternalCTA: TSurvey = {
      ...baseSurvey,
      blocks: [
        {
          id: "block1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.CTA,
              headline: createI18nString("Click here", ["en"]),
              buttonLabel: createI18nString("Visit", ["en"]),
              buttonExternal: false,
              buttonUrl: "",
              required: false,
            },
          ],
        },
      ],
    };

    await expect(
      checkExternalUrlsPermission(mockOrganizationId, surveyWithInternalCTA, null)
    ).resolves.not.toThrow();
  });

  test("should handle surveys with multiple questions and endings", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockOrganizationBilling as any);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    const complexSurvey: TSurvey = {
      ...baseSurvey,
      blocks: [
        {
          id: "block1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.OpenText,
              headline: createI18nString("Question 1", ["en"]),
              required: false,
              inputType: "text",
              charLimit: { enabled: false },
            },
            {
              id: "q2",
              type: TSurveyElementTypeEnum.CTA,
              headline: createI18nString("Click here", ["en"]),
              buttonLabel: createI18nString("Visit", ["en"]),
              buttonExternal: false,
              buttonUrl: "",
              required: false,
            },
          ],
        },
      ],
      endings: [
        {
          id: "end1",
          type: "endScreen",
          headline: createI18nString("Thank you", ["en"]),
        },
      ],
    };

    await expect(checkExternalUrlsPermission(mockOrganizationId, complexSurvey, null)).resolves.not.toThrow();
  });
});
