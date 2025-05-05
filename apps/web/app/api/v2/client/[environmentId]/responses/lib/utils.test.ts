import { getOrganizationBillingByEnvironmentId } from "@/app/api/v2/client/[environmentId]/responses/lib/organization";
import { verifyRecaptchaToken } from "@/app/api/v2/client/[environmentId]/responses/lib/recaptcha";
import {
  checkSurveyValidity,
  validateOtherOptionLengthForMultipleChoice,
} from "@/app/api/v2/client/[environmentId]/responses/lib/utils";
import { TResponseInputV2 } from "@/app/api/v2/client/[environmentId]/responses/types/response";
import { responses } from "@/app/lib/api/response";
import { MAX_OTHER_OPTION_LENGTH } from "@/lib/constants";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { Organization } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TSurveyQuestionChoice, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TSurvey } from "@formbricks/types/surveys/types";
import { validateOtherOptionLength } from "./utils";

vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn().mockImplementation((value, language) => {
    return typeof value === "string" ? value : value[language] || value["default"] || "";
  }),
}));

vi.mock("@/app/api/v2/client/[environmentId]/responses/lib/recaptcha", () => ({
  verifyRecaptchaToken: vi.fn(),
}));

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    badRequestResponse: vi.fn((message) => new Response(message, { status: 400 })),
    notFoundResponse: vi.fn((message) => new Response(message, { status: 404 })),
  },
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSpamProtectionEnabled: vi.fn(),
}));

vi.mock("@/app/api/v2/client/[environmentId]/responses/lib/organization", () => ({
  getOrganizationBillingByEnvironmentId: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("validateOtherOptionLength", () => {
  const mockChoices: TSurveyQuestionChoice[] = [
    { id: "1", label: { default: "Option 1", fr: "Option one" } },
    { id: "2", label: { default: "Option 2", fr: "Option two" } },
    { id: "3", label: { default: "Option 3", fr: "Option Trois" } },
  ];

  test("returns undefined when value matches a choice", () => {
    const result = validateOtherOptionLength("Option 1", mockChoices, "q1");
    expect(result).toBeUndefined();
  });

  test("returns undefined when other option is within length limit", () => {
    const shortValue = "A".repeat(MAX_OTHER_OPTION_LENGTH);
    const result = validateOtherOptionLength(shortValue, mockChoices, "q1");
    expect(result).toBeUndefined();
  });

  test("uses default language when no language is provided", () => {
    const result = validateOtherOptionLength("Option 3", mockChoices, "q1");
    expect(result).toBeUndefined();
  });

  test("handles localized choice labels", () => {
    const result = validateOtherOptionLength("Option Trois", mockChoices, "q1", "fr");
    expect(result).toBeUndefined();
  });

  test("returns bad request response when other option exceeds length limit", () => {
    const longValue = "A".repeat(MAX_OTHER_OPTION_LENGTH + 1);
    const result = validateOtherOptionLength(longValue, mockChoices, "q1");

    expect(result).toBeTruthy;
  });
});

const mockSurvey: TSurvey = {
  id: "survey-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  environmentId: "env-1",
  type: "link",
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
  displayLimit: null,
  endings: [],
  followUps: [],
  isBackButtonHidden: false,
  isSingleResponsePerEmailEnabled: false,
  isVerifyEmailEnabled: false,
  projectOverwrites: null,
  runOnDate: null,
  showLanguageSwitch: false,
};

const mockResponseInput: TResponseInputV2 = {
  surveyId: "survey-1",
  environmentId: "env-1",
  data: {},
  finished: false,
  ttc: {},
  meta: {},
};

const mockBillingData: Organization["billing"] = {
  limits: {
    monthly: { miu: 0, responses: 0 },
    projects: 3,
  },
  period: "monthly",
  periodStart: new Date(),
  plan: "scale",
  stripeCustomerId: "mock-stripe-customer-id",
};

describe("checkSurveyValidity", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return badRequestResponse if survey environmentId does not match", async () => {
    const survey = { ...mockSurvey, environmentId: "env-2" };
    const result = await checkSurveyValidity(survey, "env-1", mockResponseInput);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(400);
    expect(responses.badRequestResponse).toHaveBeenCalledWith(
      "Survey is part of another environment",
      {
        "survey.environmentId": "env-2",
        environmentId: "env-1",
      },
      true
    );
  });

  test("should return null if recaptcha is not enabled", async () => {
    const survey = { ...mockSurvey, recaptcha: { enabled: false, threshold: 0.5 } };
    const result = await checkSurveyValidity(survey, "env-1", mockResponseInput);
    expect(result).toBeNull();
  });

  test("should return badRequestResponse if recaptcha enabled, spam protection enabled, but token is missing", async () => {
    const survey = { ...mockSurvey, recaptcha: { enabled: true, threshold: 0.5 } };
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    const responseInputWithoutToken = { ...mockResponseInput };
    delete responseInputWithoutToken.recaptchaToken;

    const result = await checkSurveyValidity(survey, "env-1", responseInputWithoutToken);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(400);
    expect(logger.error).toHaveBeenCalledWith("Missing recaptcha token");
    expect(responses.badRequestResponse).toHaveBeenCalledWith(
      "Missing recaptcha token",
      { code: "recaptcha_verification_failed" },
      true
    );
  });

  test("should return not found response if billing data is not found", async () => {
    const survey = { ...mockSurvey, recaptcha: { enabled: true, threshold: 0.5 } };
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    vi.mocked(getOrganizationBillingByEnvironmentId).mockResolvedValue(null);

    const result = await checkSurveyValidity(survey, "env-1", {
      ...mockResponseInput,
      recaptchaToken: "test-token",
    });
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(404);
    expect(responses.notFoundResponse).toHaveBeenCalledWith("Organization", null);
    expect(getOrganizationBillingByEnvironmentId).toHaveBeenCalledWith("env-1");
  });

  test("should return null if recaptcha is enabled but spam protection is disabled", async () => {
    const survey = { ...mockSurvey, recaptcha: { enabled: true, threshold: 0.5 } };
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false);
    vi.mocked(verifyRecaptchaToken).mockResolvedValue(true);
    vi.mocked(getOrganizationBillingByEnvironmentId).mockResolvedValue(mockBillingData);
    const result = await checkSurveyValidity(survey, "env-1", {
      ...mockResponseInput,
      recaptchaToken: "test-token",
    });
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith("Spam protection is not enabled for this organization");
  });

  test("should return badRequestResponse if recaptcha verification fails", async () => {
    const survey = { ...mockSurvey, recaptcha: { enabled: true, threshold: 0.5 } };
    const responseInputWithToken = { ...mockResponseInput, recaptchaToken: "test-token" };
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    vi.mocked(verifyRecaptchaToken).mockResolvedValue(false);
    vi.mocked(getOrganizationBillingByEnvironmentId).mockResolvedValue(mockBillingData);

    const result = await checkSurveyValidity(survey, "env-1", responseInputWithToken);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(400);
    expect(verifyRecaptchaToken).toHaveBeenCalledWith("test-token", 0.5);
    expect(responses.badRequestResponse).toHaveBeenCalledWith(
      "reCAPTCHA verification failed",
      { code: "recaptcha_verification_failed" },
      true
    );
  });

  test("should return null if recaptcha verification passes", async () => {
    const survey = { ...mockSurvey, recaptcha: { enabled: true, threshold: 0.5 } };
    const responseInputWithToken = { ...mockResponseInput, recaptchaToken: "test-token" };
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    vi.mocked(verifyRecaptchaToken).mockResolvedValue(true);
    vi.mocked(getOrganizationBillingByEnvironmentId).mockResolvedValue(mockBillingData);

    const result = await checkSurveyValidity(survey, "env-1", responseInputWithToken);
    expect(result).toBeNull();
    expect(verifyRecaptchaToken).toHaveBeenCalledWith("test-token", 0.5);
  });

  test("should return null for a valid survey and input", async () => {
    const survey = { ...mockSurvey }; // Recaptcha disabled by default in mock
    const result = await checkSurveyValidity(survey, "env-1", mockResponseInput);
    expect(result).toBeNull();
  });
});

describe("validateOtherOptionLengthForMultipleChoice", () => {
  const mockChoices: TSurveyQuestionChoice[] = [
    { id: "1", label: { default: "Option 1" } },
    { id: "2", label: { default: "Option 2" } },
  ];

  const baseSurvey = {
    ...mockSurvey,
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        choices: mockChoices,
      },
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        choices: mockChoices,
      },
    ],
  } as unknown as TSurvey;

  test("returns undefined for single choice that matches a valid option", () => {
    const result = validateOtherOptionLengthForMultipleChoice({
      responseData: { q1: "Option 1" },
      survey: baseSurvey,
    });

    expect(result).toBeUndefined();
  });

  test("returns undefined for multi-select with all valid options", () => {
    const result = validateOtherOptionLengthForMultipleChoice({
      responseData: { q2: ["Option 1", "Option 2"] },
      survey: baseSurvey,
    });

    expect(result).toBeUndefined();
  });

  test("returns questionId for single choice with long 'other' option", () => {
    const longText = "X".repeat(MAX_OTHER_OPTION_LENGTH + 1);
    const result = validateOtherOptionLengthForMultipleChoice({
      responseData: { q1: longText },
      survey: baseSurvey,
    });

    expect(result).toBe("q1");
  });

  test("returns questionId for multi-select with one long 'other' option", () => {
    const longText = "Y".repeat(MAX_OTHER_OPTION_LENGTH + 1);
    const result = validateOtherOptionLengthForMultipleChoice({
      responseData: { q2: [longText] },
      survey: baseSurvey,
    });

    expect(result).toBe("q2");
  });

  test("ignores non-matching or unrelated question IDs", () => {
    const result = validateOtherOptionLengthForMultipleChoice({
      responseData: { unrelated: "Other: something" },
      survey: baseSurvey,
    });

    expect(result).toBeUndefined();
  });

  test("returns undefined if answer is not string or array", () => {
    const result = validateOtherOptionLengthForMultipleChoice({
      responseData: { q1: 123 as any },
      survey: baseSurvey,
    });

    expect(result).toBeUndefined();
  });
});
