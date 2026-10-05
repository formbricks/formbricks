import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma, Response } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getSurvey } from "@/lib/survey/service";
import {
  QuotaEvaluationInput,
  TQuotaEvaluationContext,
  evaluateResponseQuotas,
  loadQuotaEvaluationContext,
  screenResponseQuotas,
} from "./evaluation-service";
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
const asTx = (tx: MockTx) => tx as unknown as Prisma.TransactionClient;

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
    visibility: "workspace",
    ownerId: null,
    visibilityVersion: 0,
    visibilityProjectedVersion: 0,
    visibilityChangedAt: null,
    visibilityChangedById: null,
    welcomeCard: {
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
    isAutoProgressingEnabled: false,
    publishOn: null,
    closeOn: null,
    workspaceOverwrites: null,
    styling: null,
    showLanguageSwitch: null,
    languages: [],
    triggers: [],
    segment: null,
    recaptcha: null,
    createdAt: new Date("2024-01-01"),
    autoComplete: null,
    createdBy: null,
    followUps: [],
    isVerifyEmailEnabled: false,
    surveyClosedMessage: null,
    singleUse: null,
    pin: null,
    workspaceId: "workspace123",
    metadata: {},
    updatedAt: new Date("2024-01-01"),
    blocks: [],
    isCaptureIpEnabled: false,
    isAnonymizeResponsesEnabled: false,
    slug: null,
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
          leftOperand: { type: "element", value: "q1" },
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
    ingestFlags: null,
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

  const contextFor = (quotas: TSurveyQuota[], survey: TSurvey = mockSurvey): TQuotaEvaluationContext => ({
    quotas,
    survey,
  });

  describe("loadQuotaEvaluationContext", () => {
    test("returns null without reading the survey when it has no quotas", async () => {
      vi.mocked(getQuotas).mockResolvedValue([]);

      await expect(loadQuotaEvaluationContext(mockSurveyId)).resolves.toBeNull();

      expect(getQuotas).toHaveBeenCalledWith(mockSurveyId);
      expect(getSurvey).not.toHaveBeenCalled();
    });

    test("returns null when the survey does not exist", async () => {
      vi.mocked(getQuotas).mockResolvedValue([mockQuota]);
      vi.mocked(getSurvey).mockResolvedValue(null);

      await expect(loadQuotaEvaluationContext(mockSurveyId)).resolves.toBeNull();
      expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    });

    test("returns the quotas and the survey", async () => {
      vi.mocked(getQuotas).mockResolvedValue([mockQuota]);
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

      await expect(loadQuotaEvaluationContext(mockSurveyId)).resolves.toEqual({
        quotas: [mockQuota],
        survey: mockSurvey,
      });
    });

    test("logs and returns null on a failed read, so quotas can never fail an ingest", async () => {
      vi.mocked(getQuotas).mockResolvedValue([mockQuota]);
      vi.mocked(getSurvey).mockRejectedValue(new Error("Survey service error"));

      await expect(loadQuotaEvaluationContext(mockSurveyId)).resolves.toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), surveyId: mockSurveyId },
        "Error loading quota evaluation context"
      );
    });
  });

  describe("screenResponseQuotas (dry run)", () => {
    test("surfaces a failed read instead of reporting no quotas", async () => {
      vi.mocked(getQuotas).mockRejectedValue(new Error("db down"));

      await expect(screenResponseQuotas({ surveyId: mockSurveyId, data: mockResponseData })).rejects.toThrow(
        "db down"
      );
    });

    test("returns null when there is nothing to screen against", async () => {
      vi.mocked(getQuotas).mockResolvedValue([]);

      await expect(
        screenResponseQuotas({ surveyId: mockSurveyId, data: mockResponseData })
      ).resolves.toBeNull();
    });

    test("screens the payload against the survey's quotas", async () => {
      vi.mocked(getQuotas).mockResolvedValue([mockQuota]);
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(evaluateQuotas).mockReturnValue({ passedQuotas: [mockQuota], failedQuotas: [] });

      await expect(screenResponseQuotas({ surveyId: mockSurveyId, data: mockResponseData })).resolves.toEqual(
        {
          quotas: [mockQuota],
          passedQuotas: [mockQuota],
          failedQuotas: [],
        }
      );
    });
  });

  describe("evaluateResponseQuotas", () => {
    test("returns shouldEndSurvey false without touching the database when there is no context", async () => {
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        responseFinished: true,
        quotaContext: null,
      };

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({ shouldEndSurvey: false });
      expect(handleQuotas).not.toHaveBeenCalled();
    });

    test("never reads quota or survey definitions itself — they arrive preloaded (ENG-3285)", async () => {
      const continueSurveyQuota: TSurveyQuota = { ...mockQuota, action: "continueSurvey" };
      vi.mocked(evaluateQuotas).mockReturnValue({ passedQuotas: [continueSurveyQuota], failedQuotas: [] });
      vi.mocked(handleQuotas).mockResolvedValue(continueSurveyQuota);

      await evaluateResponseQuotas({
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        responseFinished: true,
        tx: asTx(mockTx),
        quotaContext: contextFor([continueSurveyQuota]),
      });

      // Each of these went through the root client, on a second pool connection, while the caller's
      // transaction held the first.
      expect(getQuotas).not.toHaveBeenCalled();
      expect(getSurvey).not.toHaveBeenCalled();
      expect(handleQuotas).toHaveBeenCalledOnce();
    });

    describe("fails closed on a context that belongs to another survey", () => {
      const foreignSurvey = { ...mockSurvey, id: "survey_of_another_tenant" };

      test.each([
        ["the survey", contextFor([{ ...mockQuota, surveyId: foreignSurvey.id }], foreignSurvey)],
        ["one of the quotas", contextFor([{ ...mockQuota, surveyId: "survey_of_another_tenant" }])],
      ])("when %s does not match the response's survey", async (_, quotaContext) => {
        vi.mocked(evaluateQuotas).mockReturnValue({ passedQuotas: quotaContext.quotas, failedQuotas: [] });
        vi.mocked(handleQuotas).mockResolvedValue(quotaContext.quotas[0]);

        const result = await evaluateResponseQuotas({
          surveyId: mockSurveyId,
          responseId: mockResponseId,
          data: mockResponseData,
          responseFinished: true,
          tx: asTx(mockTx),
          quotaContext,
        });

        // No quota links written, and no other survey's quota handed back to the respondent.
        expect(result).toEqual({ shouldEndSurvey: false });
        expect(handleQuotas).not.toHaveBeenCalled();
        expect(evaluateQuotas).not.toHaveBeenCalled();
        expect(mockTx.response.findUnique).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({ surveyId: mockSurveyId, responseId: mockResponseId }),
          expect.stringContaining("does not belong to the response's survey")
        );
      });
    });

    test("should process quotas successfully and return shouldEndSurvey false when quota action is not endSurvey", async () => {
      const continueSurveyQuota: TSurveyQuota = {
        ...mockQuota,
        action: "continueSurvey",
      };

      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        variables: mockVariablesData,
        language: "en",
        responseFinished: true,
        tx: asTx(mockTx),
        quotaContext: contextFor([continueSurveyQuota]),
      };

      const evaluateResult = {
        passedQuotas: [continueSurveyQuota],
        failedQuotas: [],
      };

      vi.mocked(evaluateQuotas).mockReturnValue(evaluateResult);
      vi.mocked(handleQuotas).mockResolvedValue(continueSurveyQuota);

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        quotaFull: continueSurveyQuota,
        shouldEndSurvey: false,
      });

      expect(evaluateQuotas).toHaveBeenCalledWith(
        mockSurvey,
        mockResponseData,
        mockVariablesData,
        [continueSurveyQuota],
        "en",
        {}
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
        tx: asTx(mockTx),
        quotaContext: contextFor([mockQuota]),
      };

      const evaluateResult = {
        passedQuotas: [mockQuota],
        failedQuotas: [],
      };

      vi.mocked(evaluateQuotas).mockReturnValue(evaluateResult);
      vi.mocked(handleQuotas).mockResolvedValue(mockQuota);
      vi.mocked(mockTx.response.findUnique).mockResolvedValue(mockResponse);

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        quotaFull: mockQuota,
        shouldEndSurvey: true,
        refreshedResponse: mockResponse,
      });

      expect(evaluateQuotas).toHaveBeenCalledWith(
        mockSurvey,
        mockResponseData,
        mockVariablesData,
        [mockQuota],
        "en",
        {}
      );
      expect(handleQuotas).toHaveBeenCalledWith(mockSurveyId, mockResponseId, evaluateResult, true, mockTx);
      expect(mockTx.response.findUnique).toHaveBeenCalledWith({
        where: { id: mockResponseId },
      });
    });

    test("should process quotas successfully and return shouldEndSurvey true when quota action is endSurvey and responseFinished is false", async () => {
      const mockPartialSubmissionQuota = {
        ...mockQuota,
        countPartialSubmissions: true,
      };

      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        variables: mockVariablesData,
        responseFinished: false,
        tx: asTx(mockTx),
        quotaContext: contextFor([mockPartialSubmissionQuota]),
      };

      const evaluateResult = {
        passedQuotas: [mockPartialSubmissionQuota],
        failedQuotas: [],
      };

      vi.mocked(evaluateQuotas).mockReturnValue(evaluateResult);
      vi.mocked(handleQuotas).mockResolvedValue(mockPartialSubmissionQuota);
      vi.mocked(mockTx.response.findUnique).mockResolvedValue(mockResponse);

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        quotaFull: mockPartialSubmissionQuota,
        shouldEndSurvey: true,
        refreshedResponse: mockResponse,
      });

      expect(evaluateQuotas).toHaveBeenCalledWith(
        mockSurvey,
        mockResponseData,
        mockVariablesData,
        [mockPartialSubmissionQuota],
        "default",
        {}
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
        quotaContext: contextFor([mockQuota]),
      };

      vi.mocked(evaluateQuotas).mockReturnValue({ passedQuotas: [mockQuota], failedQuotas: [] });
      vi.mocked(handleQuotas).mockResolvedValue(null);

      const result = await evaluateResponseQuotas(input);

      expect(result).toEqual({
        quotaFull: null,
        shouldEndSurvey: false,
      });
    });

    test("should handle evaluateQuotas error gracefully", async () => {
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        responseFinished: true,
        quotaContext: contextFor([mockQuota]),
      };

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

    test("resolves reserved-field values from the response so a reserved quota condition can match", async () => {
      // The real `buildServerEmbeddedValues` runs here (only ./utils and the data loaders are mocked),
      // so this asserts the actual catalog projection reaches `evaluateQuotas` — the wiring that was
      // missing when the helper had no production caller.
      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        variables: mockVariablesData,
        language: "en",
        responseFinished: true,
        response: {
          id: mockResponseId,
          surveyId: mockSurveyId,
          createdAt: new Date("2026-08-01T09:00:00.000Z"),
          updatedAt: new Date("2026-08-01T09:02:00.000Z"),
          finished: true,
          language: "en",
          data: mockResponseData,
          variables: mockVariablesData,
          ttc: { _total: 120_000 },
          meta: { country: "DE", userAgent: { browser: "Chrome" } },
        },
        tx: asTx(mockTx),
        quotaContext: contextFor([mockQuota]),
      };

      vi.mocked(evaluateQuotas).mockReturnValue({ passedQuotas: [mockQuota], failedQuotas: [] });
      vi.mocked(handleQuotas).mockResolvedValue(null);

      await evaluateResponseQuotas(input);

      expect(evaluateQuotas).toHaveBeenCalledWith(
        mockSurvey,
        mockResponseData,
        mockVariablesData,
        [mockQuota],
        "en",
        expect.objectContaining({
          country: "DE",
          browser: "Chrome",
          finished: "true",
          durationSeconds: 120,
        })
      );
    });

    test("should use 'default' language when provided language matches default language", async () => {
      const surveyWithLanguages = {
        ...mockSurvey,
        languages: [
          { default: true, language: { code: "en", flag: "🇺🇸" } },
          { default: false, language: { code: "fr", flag: "🇫🇷" } },
        ],
      } as unknown as TSurvey;

      const input: QuotaEvaluationInput = {
        surveyId: mockSurveyId,
        responseId: mockResponseId,
        data: mockResponseData,
        variables: mockVariablesData,
        language: "en",
        responseFinished: true,
        tx: asTx(mockTx),
        quotaContext: contextFor([mockQuota], surveyWithLanguages),
      };

      vi.mocked(evaluateQuotas).mockReturnValue({ passedQuotas: [mockQuota], failedQuotas: [] });
      vi.mocked(handleQuotas).mockResolvedValue(null);

      await evaluateResponseQuotas(input);

      expect(evaluateQuotas).toHaveBeenCalledWith(
        surveyWithLanguages,
        mockResponseData,
        mockVariablesData,
        [mockQuota],
        "default",
        {}
      );
    });
  });
});
