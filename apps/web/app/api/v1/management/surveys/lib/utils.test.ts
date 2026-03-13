import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import {
  TSurvey,
  TSurveyCreateInputWithEnvironmentId,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { checkFeaturePermissions } from "./utils";

// Mock dependencies
vi.mock("@/app/lib/api/response", () => ({
  responses: {
    forbiddenResponse: vi.fn((message) => new Response(message, { status: 403 })),
  },
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSpamProtectionEnabled: vi.fn(),
}));

vi.mock("@/modules/survey/follow-ups/lib/utils", () => ({
  getSurveyFollowUpsPermission: vi.fn(),
}));

vi.mock("@/modules/survey/lib/permission", () => ({
  getExternalUrlsPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/survey/utils", () => ({
  getElementsFromBlocks: vi.fn((blocks: any[]) => blocks.flatMap((block: any) => block.elements)),
}));

const mockOrganization: TOrganization = {
  id: "test-org",
  name: "Test Organization",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: {
    stripeCustomerId: null,
    limits: {
      projects: 3,
      monthly: {
        responses: 1500,
      },
    },
    usageCycleAnchor: new Date(),
  },
  isAIEnabled: false,
};

const mockFollowUp: TSurveyCreateInputWithEnvironmentId["followUps"][number] = {
  id: "followup1",
  surveyId: "mockSurveyId",
  name: "Test Follow-up",
  trigger: {
    type: "response",
    properties: null,
  },
  action: {
    type: "send-email",
    properties: {
      to: "mockQuestion1Id",
      from: "noreply@example.com",
      replyTo: [],
      subject: "Follow-up Subject",
      body: "Follow-up Body",
      attachResponseData: false,
    },
  },
};

const mockLanguage: TSurveyCreateInputWithEnvironmentId["languages"][number] = {
  language: {
    id: "lang1",
    code: "en",
    alias: "English",
    createdAt: new Date(),
    projectId: "mockProjectId",
    updatedAt: new Date(),
  },
  default: true,
  enabled: true,
};

const baseSurveyData: TSurveyCreateInputWithEnvironmentId = {
  name: "Test Survey",
  environmentId: "test-env",
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Q1" },
      required: false,
      charLimit: {},
      inputType: "text",
    },
  ],
  endings: [],
  languages: [],
  type: "link",
  welcomeCard: { enabled: false, showResponseCount: false, timeToFinish: false },
  blocks: [],
  followUps: [],
};

describe("checkFeaturePermissions", () => {
  vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);

  afterEach(() => {
    vi.clearAllMocks();
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
  });

  test("should return null if no restricted features are used", async () => {
    const surveyData = { ...baseSurveyData };
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeNull();
  });

  // Recaptcha tests
  test("should return forbiddenResponse if recaptcha is enabled but permission denied", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false);
    const surveyData = { ...baseSurveyData, recaptcha: { enabled: true, threshold: 0.5 } };
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(403);
    expect(responses.forbiddenResponse).toHaveBeenCalledWith(
      "Spam protection is not enabled for this organization"
    );
  });

  test("should return null if recaptcha is enabled and permission granted", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    const surveyData: TSurveyCreateInputWithEnvironmentId = {
      ...baseSurveyData,
      recaptcha: { enabled: true, threshold: 0.5 },
    };
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeNull();
  });

  // Follow-ups tests
  test("should return forbiddenResponse if follow-ups are used but permission denied", async () => {
    vi.mocked(getSurveyFollowUpsPermission).mockResolvedValue(false);
    const surveyData = {
      ...baseSurveyData,
      followUps: [mockFollowUp],
    }; // Add minimal follow-up data
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(403);
    expect(responses.forbiddenResponse).toHaveBeenCalledWith(
      "Survey follow ups are not allowed for this organization"
    );
  });

  test("should return null if follow-ups are used and permission granted", async () => {
    vi.mocked(getSurveyFollowUpsPermission).mockResolvedValue(true);
    const surveyData = { ...baseSurveyData, followUps: [mockFollowUp] }; // Add minimal follow-up data
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeNull();
  });

  // Combined tests
  test("should return null if multiple features are used and all permissions granted", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    vi.mocked(getSurveyFollowUpsPermission).mockResolvedValue(true);
    const surveyData = {
      ...baseSurveyData,
      recaptcha: { enabled: true, threshold: 0.5 },
      followUps: [mockFollowUp],
      languages: [mockLanguage],
    };
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeNull();
  });

  test("should return forbiddenResponse for the first denied feature (recaptcha)", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false); // Denied
    vi.mocked(getSurveyFollowUpsPermission).mockResolvedValue(true);
    const surveyData = {
      ...baseSurveyData,
      recaptcha: { enabled: true, threshold: 0.5 },
      followUps: [mockFollowUp],
      languages: [mockLanguage],
    };
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(403);
    expect(responses.forbiddenResponse).toHaveBeenCalledWith(
      "Spam protection is not enabled for this organization"
    );
    expect(responses.forbiddenResponse).toHaveBeenCalledTimes(1); // Ensure it stops at the first failure
  });

  test("should return forbiddenResponse for the first denied feature (follow-ups)", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    vi.mocked(getSurveyFollowUpsPermission).mockResolvedValue(false); // Denied
    const surveyData = {
      ...baseSurveyData,
      recaptcha: { enabled: true, threshold: 0.5 },
      followUps: [mockFollowUp],
      languages: [mockLanguage],
    };
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(403);
    expect(responses.forbiddenResponse).toHaveBeenCalledWith(
      "Survey follow ups are not allowed for this organization"
    );
    expect(responses.forbiddenResponse).toHaveBeenCalledTimes(1); // Ensure it stops at the first failure
  });

  // External URLs - ending card button link tests
  test("should return forbiddenResponse when adding new ending with buttonLink without permission", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const surveyData = {
      ...baseSurveyData,
      endings: [
        {
          id: "ending1",
          type: "endScreen" as const,
          headline: { default: "Thanks" },
          subheader: { default: "" },
          buttonLink: "https://example.com",
          buttonLabel: { default: "Click" },
        },
      ],
    };
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(403);
    expect(responses.forbiddenResponse).toHaveBeenCalledWith(
      "External URLs are not enabled for this organization. Upgrade to use external button links."
    );
  });

  test("should return forbiddenResponse when changing ending buttonLink without permission", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const surveyData = {
      ...baseSurveyData,
      endings: [
        {
          id: "ending1",
          type: "endScreen" as const,
          headline: { default: "Thanks" },
          subheader: { default: "" },
          buttonLink: "https://new-url.com",
          buttonLabel: { default: "Click" },
        },
      ],
    };
    const oldSurvey = {
      endings: [
        {
          id: "ending1",
          type: "endScreen" as const,
          headline: { default: "Thanks" },
          subheader: { default: "" },
          buttonLink: "https://old-url.com",
          buttonLabel: { default: "Click" },
        },
      ],
    } as unknown as TSurvey;
    const result = await checkFeaturePermissions(surveyData, mockOrganization, oldSurvey);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(403);
  });

  test("should allow keeping existing ending buttonLink without permission (grandfathering)", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const surveyData = {
      ...baseSurveyData,
      endings: [
        {
          id: "ending1",
          type: "endScreen" as const,
          headline: { default: "Thanks" },
          subheader: { default: "" },
          buttonLink: "https://existing-url.com",
          buttonLabel: { default: "Click" },
        },
      ],
    };
    const oldSurvey = {
      endings: [
        {
          id: "ending1",
          type: "endScreen" as const,
          headline: { default: "Thanks" },
          subheader: { default: "" },
          buttonLink: "https://existing-url.com",
          buttonLabel: { default: "Click" },
        },
      ],
    } as unknown as TSurvey;
    const result = await checkFeaturePermissions(surveyData, mockOrganization, oldSurvey);
    expect(result).toBeNull();
  });

  test("should allow ending buttonLink when permission is granted", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
    const surveyData = {
      ...baseSurveyData,
      endings: [
        {
          id: "ending1",
          type: "endScreen" as const,
          headline: { default: "Thanks" },
          subheader: { default: "" },
          buttonLink: "https://example.com",
          buttonLabel: { default: "Click" },
        },
      ],
    };
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeNull();
  });

  // External URLs - CTA external button tests
  test("should return forbiddenResponse when adding CTA with external button without permission", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const surveyData = {
      ...baseSurveyData,
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "cta1",
              type: TSurveyQuestionTypeEnum.CTA,
              headline: { default: "CTA" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://example.com",
              ctaButtonLabel: { default: "Click" },
            },
          ],
          buttonLabel: { default: "Next" },
        },
      ],
    };
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(403);
    expect(responses.forbiddenResponse).toHaveBeenCalledWith(
      "External URLs are not enabled for this organization. Upgrade to use external CTA buttons."
    );
  });

  test("should return forbiddenResponse when changing CTA external button URL without permission", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const surveyData = {
      ...baseSurveyData,
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "cta1",
              type: TSurveyQuestionTypeEnum.CTA,
              headline: { default: "CTA" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://new-url.com",
              ctaButtonLabel: { default: "Click" },
            },
          ],
          buttonLabel: { default: "Next" },
        },
      ],
    };
    const oldSurvey = {
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "cta1",
              type: TSurveyQuestionTypeEnum.CTA,
              headline: { default: "CTA" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://old-url.com",
              ctaButtonLabel: { default: "Click" },
            },
          ],
          buttonLabel: { default: "Next" },
        },
      ],
      endings: [],
    } as unknown as TSurvey;
    const result = await checkFeaturePermissions(surveyData, mockOrganization, oldSurvey);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(403);
  });

  test("should allow keeping existing CTA external button without permission (grandfathering)", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const surveyData = {
      ...baseSurveyData,
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "cta1",
              type: TSurveyQuestionTypeEnum.CTA,
              headline: { default: "CTA" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://existing-url.com",
              ctaButtonLabel: { default: "Click" },
            },
          ],
          buttonLabel: { default: "Next" },
        },
      ],
    };
    const oldSurvey = {
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "cta1",
              type: TSurveyQuestionTypeEnum.CTA,
              headline: { default: "CTA" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://existing-url.com",
              ctaButtonLabel: { default: "Click" },
            },
          ],
          buttonLabel: { default: "Next" },
        },
      ],
      endings: [],
    } as unknown as TSurvey;
    const result = await checkFeaturePermissions(surveyData, mockOrganization, oldSurvey);
    expect(result).toBeNull();
  });

  test("should allow CTA external button when permission is granted", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
    const surveyData = {
      ...baseSurveyData,
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "cta1",
              type: TSurveyQuestionTypeEnum.CTA,
              headline: { default: "CTA" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://example.com",
              ctaButtonLabel: { default: "Click" },
            },
          ],
          buttonLabel: { default: "Next" },
        },
      ],
    };
    const result = await checkFeaturePermissions(surveyData, mockOrganization);
    expect(result).toBeNull();
  });

  test("should return forbiddenResponse when switching CTA from internal to external without permission", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const surveyData = {
      ...baseSurveyData,
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "cta1",
              type: TSurveyQuestionTypeEnum.CTA,
              headline: { default: "CTA" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://example.com",
              ctaButtonLabel: { default: "Click" },
            },
          ],
          buttonLabel: { default: "Next" },
        },
      ],
    };
    const oldSurvey = {
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "cta1",
              type: TSurveyQuestionTypeEnum.CTA,
              headline: { default: "CTA" },
              required: false,
              buttonExternal: false,
              buttonUrl: "",
              ctaButtonLabel: { default: "Click" },
            },
          ],
          buttonLabel: { default: "Next" },
        },
      ],
      endings: [],
    } as unknown as TSurvey;
    const result = await checkFeaturePermissions(surveyData, mockOrganization, oldSurvey);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(403);
  });
});
