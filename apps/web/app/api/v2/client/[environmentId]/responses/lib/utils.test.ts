import { verifyRecaptchaToken } from "@/app/api/v2/client/[environmentId]/responses/lib/recaptcha";
import { checkSurveyValidity } from "@/app/api/v2/client/[environmentId]/responses/lib/utils";
import { TResponseInputV2 } from "@/app/api/v2/client/[environmentId]/responses/types/response";
import { responses } from "@/app/lib/api/response";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TSurvey } from "@formbricks/types/surveys/types";

vi.mock("@/app/api/v2/client/[environmentId]/responses/lib/recaptcha", () => ({
  verifyRecaptchaToken: vi.fn(),
}));

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    badRequestResponse: vi.fn((message) => new Response(message, { status: 400 })),
  },
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSpamProtectionEnabled: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

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

describe("checkSurveyValidity", () => {
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

  test("should return null if recaptcha is enabled but spam protection is disabled", async () => {
    const survey = { ...mockSurvey, recaptcha: { enabled: true, threshold: 0.5 } };
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false);
    const result = await checkSurveyValidity(survey, "env-1", mockResponseInput);
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith("Spam protection is not enabled for this organization");
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

  test("should return badRequestResponse if recaptcha verification fails", async () => {
    const survey = { ...mockSurvey, recaptcha: { enabled: true, threshold: 0.5 } };
    const responseInputWithToken = { ...mockResponseInput, recaptchaToken: "test-token" };
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    vi.mocked(verifyRecaptchaToken).mockResolvedValue(false);

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
