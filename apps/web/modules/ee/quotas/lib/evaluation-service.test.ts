import { getSurvey } from "@/lib/survey/service";
import { Response } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TSurvey } from "@formbricks/types/surveys/types";
import { QuotaEvaluationInput, evaluateResponseQuotas } from "./evaluation-service";
import { getQuotas } from "./quotas";
import { evaluateQuotas, handleQuotas } from "./utils";

// Mock dependencies
vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    response: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("./quotas", () => ({
  getQuotas: vi.fn(),
}));

vi.mock("./utils", () => ({
  evaluateQuotas: vi.fn(),
  handleQuotas: vi.fn(),
}));

type MockTx = {
  $transaction: ReturnType<typeof vi.fn>;
  response: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};
let mockTx: MockTx;

describe("Quota Evaluation Service", () => {
  const mockSurveyId = "survey123";
  const mockResponseId = "response123";
  const mockQuotaId = "quota123";
  const mockEndingCardId = "ending123";

  const mockSurvey: TSurvey = {
    id: mockSurveyId,
    name: "Test Survey",
    type: "link",
    status: "inProgress",
    welcomeCard: {
      html: { default: "Welcome" },
      enabled: false,
      headline: { default: "Welcome!" },
      buttonLabel: { default: "Next" },
      timeToFinish: false,
      showResponseCount: false,
    },
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "What's your age?" },
        required: true,
        charLimit: {},
        inputType: "number",
        longAnswer: false,
        buttonLabel: { default: "Next" },
        placeholder: { default: "Enter age" },
      },
    ],
    endings: [
      {
        id: mockEndingCardId,
        type: "endScreen",
        headline: { default: "Thank you!" },
        subheader: { default: "Survey completed" },
        buttonLink: "https://example.com",
        buttonLabel: { default: "Done" },
      },
    ],
    hiddenFields: { enabled: true, fieldIds: [] },
    variables: [],
    displayOption: "displayOnce",
    recontactDays: null,
    displayLimit: null,
    autoClose: null,
    delay: 0,
    displayPercentage: null,
    isBackButtonHidden: false,
    projectOverwrites: null,
    styling: null,
    showLanguageSwitch: null,
    languages: [],
    triggers: [],
    segment: null,
    recaptcha: null,
    createdAt: new Date("2024-01-01"),
    autoComplete: null,
    closeOnDate: null,
    createdBy: null,
    followUps: [],
    isVerifyEmailEnabled: false,
    isSingleResponsePerEmailEnabled: false,
    surveyClosedMessage: null,
    singleUse: null,
    pin: null,
    environmentId: "env123",
    metadata: {},
    runOnDate: null,
    updatedAt: new Date("2024-01-01"),
  };

  const mockQuota: TSurveyQuota = {
    id: mockQuotaId,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    surveyId: mockSurveyId,
    name: "Age 18-25 Quota",
    limit: 50,
    logic: {
      connector: "and",
      conditions: [
        {
          id: "c1",
          leftOperand: { type: "question", value: "q1" },
          operator: "isGreaterThanOrEqual",
          rightOperand: { type: "static", value: 18 },
        },
      ],
    },
    action: "endSurvey",
    endingCardId: mockEndingCardId,
    countPartialSubmissions: false,
  };

  const mockResponseData: TResponseData = {
    q1: "22",
  };

  const mockVariablesData: TResponseVariables = {};

  const mockResponse: Response = {
    id: mockResponseId,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    surveyId: mockSurveyId,
    finished: false,
    data: mockResponseData,
    ttc: null,
    contactAttributes: {},
    variables: mockVariablesData,
    meta: {},
    contactId: null,
    singleUseId: null,
    language: "default",
    endingId: null,
    displayId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTx = {
      $transaction: vi.fn(),
      response: {
        findUnique: vi.fn(),
      },
    };
    prisma.$transaction = vi.fn(async (cb: any) => cb(mockTx));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("evaluateResponseQuotas", () => {
    test("should return shouldEndSurvey false when no quotas exist", async () => {
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        responseFinished: true,
      };

      vi.mocked(getQuotas).mockResolvedValue([]);

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        shouldEndSurvey: false,
      });
      expect(getQuotas).toHaveBeenCalledWith(mockSurveyId);
      expect(getSurvey).not.toHaveBeenCalled();
    });

    test("should return shouldEndSurvey false when survey not found", async () => {
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        responseFinished: true,
      };

      vi.mocked(getQuotas).mockResolvedValue([mockQuota]);
      vi.mocked(getSurvey).mockResolvedValue(null);

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        shouldEndSurvey: false,
      });
      expect(getQuotas).toHaveBeenCalledWith(mockSurveyId);
      expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    });

    test("should process quotas successfully and return shouldEndSurvey false when quota action is not endSurvey", async () => {
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        variables: mockVariablesData,
        language: "en",
        responseFinished: true,
        tx: mockTx,
      };

      const continueSurveyQuota: TSurveyQuota = {
        ...mockQuota,
        action: "continueSurvey",
      };

      const evaluateResult = {
        passedQuotas: [continueSurveyQuota],
        failedQuotas: [],
      };

      vi.mocked(getQuotas).mockResolvedValue([continueSurveyQuota]);
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(evaluateQuotas).mockReturnValue(evaluateResult);
      vi.mocked(handleQuotas).mockResolvedValue(continueSurveyQuota);

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        quotaFull: continueSurveyQuota,
        shouldEndSurvey: false,
      });

      expect(getQuotas).toHaveBeenCalledWith(mockSurveyId);
      expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
      expect(evaluateQuotas).toHaveBeenCalledWith(
        mockSurvey,
        mockResponseData,
        mockVariablesData,
        [continueSurveyQuota],
        "en"
      );
      expect(handleQuotas).toHaveBeenCalledWith(mockSurveyId, mockResponseId, evaluateResult, true, mockTx);
    });

    test("should process quotas successfully and return shouldEndSurvey true when quota action is endSurvey", async () => {
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        variables: mockVariablesData,
        language: "en",
        responseFinished: true,
        tx: mockTx,
      };

      const evaluateResult = {
        passedQuotas: [mockQuota],
        failedQuotas: [],
      };

      vi.mocked(getQuotas).mockResolvedValue([mockQuota]);
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(evaluateQuotas).mockReturnValue(evaluateResult);
      vi.mocked(handleQuotas).mockResolvedValue(mockQuota);
      vi.mocked(mockTx.response.findUnique).mockResolvedValue(mockResponse);

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        quotaFull: mockQuota,
        shouldEndSurvey: true,
        refreshedResponse: mockResponse,
      });

      expect(getQuotas).toHaveBeenCalledWith(mockSurveyId);
      expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
      expect(evaluateQuotas).toHaveBeenCalledWith(
        mockSurvey,
        mockResponseData,
        mockVariablesData,
        [mockQuota],
        "en"
      );
      expect(handleQuotas).toHaveBeenCalledWith(mockSurveyId, mockResponseId, evaluateResult, true, mockTx);
      expect(mockTx.response.findUnique).toHaveBeenCalledWith({
        where: { id: mockResponseId },
      });
    });

    test("should process quotas successfully and return shouldEndSurvey true when quota action is endSurvey and responseFinished is false", async () => {
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        variables: mockVariablesData,
        responseFinished: false,
        tx: mockTx,
      };

      const mockPartialSubmissionQuota = {
        ...mockQuota,
        countPartialSubmissions: true,
      };

      const evaluateResult = {
        passedQuotas: [mockPartialSubmissionQuota],
        failedQuotas: [],
      };

      vi.mocked(getQuotas).mockResolvedValue([mockPartialSubmissionQuota]);
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(evaluateQuotas).mockReturnValue(evaluateResult);
      vi.mocked(handleQuotas).mockResolvedValue(mockPartialSubmissionQuota);
      vi.mocked(mockTx.response.findUnique).mockResolvedValue(mockResponse);

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        quotaFull: mockPartialSubmissionQuota,
        shouldEndSurvey: true,
        refreshedResponse: mockResponse,
      });

      expect(getQuotas).toHaveBeenCalledWith(mockSurveyId);
      expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
      expect(evaluateQuotas).toHaveBeenCalledWith(
        mockSurvey,
        mockResponseData,
        mockVariablesData,
        [mockPartialSubmissionQuota],
        "default"
      );
      expect(handleQuotas).toHaveBeenCalledWith(mockSurveyId, mockResponseId, evaluateResult, false, mockTx);
      expect(mockTx.response.findUnique).toHaveBeenCalledWith({ where: { id: mockResponseId } });
    });

    test("should return shouldEndSurvey false when handleQuotas returns null", async () => {
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        variables: mockVariablesData,
        language: "en",
        responseFinished: true,
      };

      const evaluateResult = {
        passedQuotas: [mockQuota],
        failedQuotas: [],
      };

      vi.mocked(getQuotas).mockResolvedValue([mockQuota]);
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(evaluateQuotas).mockReturnValue(evaluateResult);
      vi.mocked(handleQuotas).mockResolvedValue(null);

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        quotaFull: null,
        shouldEndSurvey: false,
      });
    });

    test("should handle getSurvey error gracefully", async () => {
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        responseFinished: true,
      };

      vi.mocked(getQuotas).mockResolvedValue([mockQuota]);
      vi.mocked(getSurvey).mockRejectedValue(new Error("Survey service error"));

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        shouldEndSurvey: false,
      });

      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), responseId: mockResponseId },
        "Error evaluating quotas for response"
      );
    });

    test("should handle evaluateQuotas error gracefully", async () => {
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        responseFinished: true,
      };

      vi.mocked(getQuotas).mockResolvedValue([mockQuota]);
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(evaluateQuotas).mockImplementation(() => {
        throw new Error("Evaluation error");
      });

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        shouldEndSurvey: false,
      });

      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), responseId: mockResponseId },
        "Error evaluating quotas for response"
      );
    });
  });
});
