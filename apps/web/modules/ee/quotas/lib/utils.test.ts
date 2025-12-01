import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { updateResponse } from "@/lib/response/service";
import { evaluateLogic } from "@/lib/surveyLogic/utils";
import { validateInputs } from "@/lib/utils/validate";
import { evaluateQuotas, handleQuotas, upsertResponseQuotaLinks } from "./utils";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    responseQuotaLink: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@/lib/response/service", () => ({
  updateResponse: vi.fn(),
}));

vi.mock("@/lib/surveyLogic/utils", () => ({
  evaluateLogic: vi.fn(),
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

type MockTx = {
  responseQuotaLink: {
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
};
let mockTx: MockTx;

describe("Quota Utils", () => {
  const mockSurveyId = "survey123";
  const mockResponseId = "response123";
  const mockQuotaId = "quota123";
  const mockEndingCardId = "ending123";

  const mockSurvey: TJsEnvironmentStateSurvey = {
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
        {
          id: "c2",
          leftOperand: { type: "element", value: "q1" },
          operator: "isLessThanOrEqual",
          rightOperand: { type: "static", value: 25 },
        },
      ],
    },
    action: "endSurvey",
    endingCardId: mockEndingCardId,
    countPartialSubmissions: false,
  };

  const mockQuota2: TSurveyQuota = {
    id: "quota456",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    surveyId: mockSurveyId,
    name: "Age 26+ Quota",
    limit: 30,
    logic: {
      connector: "and",
      conditions: [
        {
          id: "c3",
          leftOperand: { type: "element", value: "q1" },
          operator: "isGreaterThan",
          rightOperand: { type: "static", value: 25 },
        },
      ],
    },
    action: "continueSurvey",
    endingCardId: null,
    countPartialSubmissions: true,
  };

  const mockResponseData: TResponseData = {
    q1: "22",
  };

  const mockVariablesData: TResponseVariables = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = {
      responseQuotaLink: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
    };
    prisma.$transaction = vi.fn(async (cb: any) => cb(mockTx));

    vi.mocked(validateInputs).mockImplementation(() => {
      return [];
    });
    vi.mocked(evaluateLogic).mockReturnValue(true);

    vi.mocked(mockTx.responseQuotaLink.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(mockTx.responseQuotaLink.createMany).mockResolvedValue({ count: 0 });
    vi.mocked(mockTx.responseQuotaLink.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(mockTx.responseQuotaLink.count).mockResolvedValue(0);
    vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValue([]);
    vi.mocked(updateResponse).mockResolvedValue({} as any);
    vi.mocked(logger.error).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("evaluateQuotas", () => {
    test("should evaluate quotas and return passed and failed quotas", () => {
      vi.mocked(evaluateLogic).mockReturnValueOnce(true).mockReturnValueOnce(false);

      const result = evaluateQuotas(
        mockSurvey,
        mockResponseData,
        mockVariablesData,
        [mockQuota, mockQuota2],
        "default"
      );

      expect(result.passedQuotas).toEqual([mockQuota]);
      expect(result.failedQuotas).toEqual([mockQuota2]);
      expect(evaluateLogic).toHaveBeenCalledTimes(2);
      expect(evaluateLogic).toHaveBeenCalledWith(
        mockSurvey,
        mockResponseData,
        mockVariablesData,
        {
          id: mockQuota.id,
          ...mockQuota.logic,
        },
        "default"
      );
    });

    test("should handle empty quotas array", () => {
      const result = evaluateQuotas(mockSurvey, mockResponseData, mockVariablesData, [], "en");

      expect(result.passedQuotas).toEqual([]);
      expect(result.failedQuotas).toEqual([]);
      expect(evaluateLogic).not.toHaveBeenCalled();
    });

    test("should handle all quotas passing", () => {
      vi.mocked(evaluateLogic).mockReturnValue(true);

      const result = evaluateQuotas(mockSurvey, mockResponseData, mockVariablesData, [mockQuota, mockQuota2]);

      expect(result.passedQuotas).toEqual([mockQuota, mockQuota2]);
      expect(result.failedQuotas).toEqual([]);
    });

    test("should handle all quotas failing", () => {
      vi.mocked(evaluateLogic).mockReturnValue(false);

      const result = evaluateQuotas(mockSurvey, mockResponseData, mockVariablesData, [mockQuota, mockQuota2]);

      expect(result.passedQuotas).toEqual([]);
      expect(result.failedQuotas).toEqual([mockQuota, mockQuota2]);
    });

    test("should use default language when not provided", () => {
      vi.mocked(evaluateLogic).mockReturnValue(true);

      evaluateQuotas(mockSurvey, mockResponseData, mockVariablesData, [mockQuota]);

      expect(evaluateLogic).toHaveBeenCalledWith(
        mockSurvey,
        mockResponseData,
        mockVariablesData,
        {
          id: mockQuota.id,
          ...mockQuota.logic,
        },
        "default"
      );
    });
  });

  describe("upsertResponseQuotaLinks", () => {
    test("should delete, create, and update quota links successfully within transaction", async () => {
      const fullQuotas = [mockQuota];
      const otherQuotas = [mockQuota2];
      const failedQuotas = [{ ...mockQuota, id: "failed123" }];

      await upsertResponseQuotaLinks(mockResponseId, fullQuotas, otherQuotas, failedQuotas, mockTx);

      // Verify transaction was called
      expect(mockTx.responseQuotaLink.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockTx.responseQuotaLink.createMany).toHaveBeenCalledTimes(2);
      expect(mockTx.responseQuotaLink.updateMany).toHaveBeenCalledTimes(1);
    });

    test("should handle empty quota arrays within transaction", async () => {
      await upsertResponseQuotaLinks(mockResponseId, [], [], [], mockTx);

      // Verify transaction was called even with empty arrays
      // expect(mockTx).toHaveBeenCalledTimes(1);
      // expect(mockTx).toHaveBeenCalledWith(expect.any(Function));
    });

    test("should execute correct operations within transaction", async () => {
      const fullQuotas = [mockQuota];
      const otherQuotas = [mockQuota2];
      const failedQuotas = [{ ...mockQuota, id: "failed123" }];

      await upsertResponseQuotaLinks(mockResponseId, fullQuotas, otherQuotas, failedQuotas, mockTx);

      // Verify correct operations were called within transaction
      expect(mockTx.responseQuotaLink.deleteMany).toHaveBeenCalledWith({
        where: {
          responseId: mockResponseId,
          quotaId: { in: ["failed123"] },
        },
      });

      expect(mockTx.responseQuotaLink.createMany).toHaveBeenCalledWith({
        data: [
          {
            responseId: mockResponseId,
            quotaId: mockQuotaId,
            status: "screenedOut",
          },
        ],
        skipDuplicates: true,
      });

      expect(mockTx.responseQuotaLink.updateMany).toHaveBeenCalledWith({
        where: {
          responseId: mockResponseId,
          quotaId: { in: [mockQuotaId] },
          status: { not: "screenedOut" },
        },
        data: {
          status: "screenedOut",
        },
      });

      expect(mockTx.responseQuotaLink.createMany).toHaveBeenCalledWith({
        data: [
          {
            responseId: mockResponseId,
            quotaId: "quota456",
            status: "screenedIn",
          },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe("handleQuotas", () => {
    const mockResult = {
      passedQuotas: [mockQuota, mockQuota2],
      failedQuotas: [],
    };

    test("should return null when no quotas are full", async () => {
      // Mock groupBy to return counts below the limits
      vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValueOnce([
        { quotaId: mockQuotaId, _count: { responseId: 10 } } as any,
        { quotaId: "quota456", _count: { responseId: 25 } } as any,
      ]);

      const result = await handleQuotas(mockSurveyId, mockResponseId, mockResult, true, mockTx);

      expect(result).toBeNull();
      expect(validateInputs).toHaveBeenCalledWith(
        [mockSurveyId, expect.any(Object)],
        [mockResponseId, expect.any(Object)]
      );
    });

    test("should return first screened out quota when quota is full", async () => {
      // Mock groupBy to return count at/above limit for first quota
      vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValueOnce([
        { quotaId: mockQuotaId, _count: { responseId: 50 } } as any, // mockQuota at limit
        { quotaId: "quota456", _count: { responseId: 25 } } as any, // mockQuota2 below limit
      ]);

      const result = await handleQuotas(mockSurveyId, mockResponseId, mockResult, true, mockTx);

      expect(result).toEqual(mockQuota);
      expect(mockTx.responseQuotaLink.groupBy).toHaveBeenCalledTimes(1);
    });

    test("should update response to finished when quota action is endSurvey", async () => {
      // Mock groupBy to return quota at limit
      vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValueOnce([
        { quotaId: mockQuotaId, _count: { responseId: 50 } } as any, // mockQuota at limit
        { quotaId: "quota456", _count: { responseId: 25 } } as any, // mockQuota2 below limit
      ]);

      const result = await handleQuotas(mockSurveyId, mockResponseId, mockResult, true, mockTx);

      expect(result).toEqual(mockQuota);
      expect(updateResponse).toHaveBeenCalledWith(
        mockResponseId,
        {
          finished: true,
          endingId: mockEndingCardId,
        },
        mockTx
      );
    });

    test("should not update response when quota action is continueSurvey", async () => {
      const resultWithContinueAction = {
        passedQuotas: [mockQuota2],
        failedQuotas: [],
      };
      // Mock groupBy to return quota at limit for mockQuota2 (which counts all)
      vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValueOnce([
        { quotaId: "quota456", _count: { responseId: 30 } } as any, // mockQuota2 at limit
      ]);

      const result = await handleQuotas(mockSurveyId, mockResponseId, resultWithContinueAction, true, mockTx);

      expect(result).toEqual(mockQuota2);
      expect(updateResponse).not.toHaveBeenCalled();
    });

    test("should count all responses when countPartialSubmissions is true", async () => {
      const resultWithPartialCount = {
        passedQuotas: [mockQuota2],
        failedQuotas: [],
      };
      vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValueOnce([
        { quotaId: "quota456", _count: { responseId: 25 } } as any, // mockQuota2 below limit
      ]);

      await handleQuotas(mockSurveyId, mockResponseId, resultWithPartialCount, true, mockTx);

      expect(mockTx.responseQuotaLink.groupBy).toHaveBeenCalledWith({
        by: ["quotaId"],
        where: {
          quotaId: { in: ["quota456"] },
          status: "screenedIn",
          response: {
            id: {
              not: mockResponseId,
            },
          },
          OR: [{ quota: { countPartialSubmissions: true } }, { response: { finished: true } }],
        },
        _count: {
          responseId: true,
        },
      });
    });

    test("should count only finished responses when countPartialSubmissions is false", async () => {
      const resultWithFinishedOnly = {
        passedQuotas: [mockQuota],
        failedQuotas: [],
      };
      vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValueOnce([
        { quotaId: mockQuotaId, _count: { responseId: 45 } } as any, // mockQuota below limit
      ]);

      await handleQuotas(mockSurveyId, mockResponseId, resultWithFinishedOnly, true, mockTx);

      expect(mockTx.responseQuotaLink.groupBy).toHaveBeenCalledWith({
        by: ["quotaId"],
        where: {
          quotaId: { in: [mockQuotaId] },
          status: "screenedIn",
          response: {
            id: {
              not: mockResponseId,
            },
          },
          OR: [{ quota: { countPartialSubmissions: true } }, { response: { finished: true } }],
        },
        _count: {
          responseId: true,
        },
      });
    });

    test("should call upsertResponseQuotaLinks with correct parameters", async () => {
      const failedQuotas = [{ ...mockQuota, id: "failed123" }];

      const testResult = {
        passedQuotas: [mockQuota, mockQuota2],
        failedQuotas,
      };

      vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValueOnce([
        { quotaId: mockQuotaId, _count: { responseId: 50 } } as any, // mockQuota at limit
        { quotaId: "quota456", _count: { responseId: 25 } } as any, // mockQuota2 below limit
      ]);

      await handleQuotas(mockSurveyId, mockResponseId, testResult, true, mockTx);

      // Verify transaction was called (upsertResponseQuotaLinks uses transaction)
      expect(mockTx.responseQuotaLink.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockTx.responseQuotaLink.createMany).toHaveBeenCalledTimes(2);
      expect(mockTx.responseQuotaLink.updateMany).toHaveBeenCalledTimes(1);
    });

    test("should return first screened out quota when multiple quotas are full", async () => {
      const bothQuotasFull = {
        passedQuotas: [mockQuota, mockQuota2],
        failedQuotas: [],
      };

      vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValueOnce([
        { quotaId: "quota456", _count: { responseId: 30 } } as any, // mockQuota2 at limit
        { quotaId: mockQuotaId, _count: { responseId: 50 } } as any, // mockQuota at limit
      ]);

      const result = await handleQuotas(mockSurveyId, mockResponseId, bothQuotasFull, true, mockTx);

      expect(result).toEqual(mockQuota);
    });

    test("should handle validation errors", async () => {
      vi.mocked(validateInputs).mockImplementation(() => {
        throw new Error("Validation failed");
      });

      const result = await handleQuotas(mockSurveyId, mockResponseId, mockResult, true, mockTx);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        {
          error: expect.any(Error),
          responseId: mockResponseId,
          surveyId: mockSurveyId,
        },
        "Error checking quotas full"
      );
    });

    test("should handle Prisma errors gracefully", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(mockTx.responseQuotaLink.groupBy).mockRejectedValue(prismaError);

      const result = await handleQuotas(mockSurveyId, mockResponseId, mockResult, true, mockTx);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        {
          error: prismaError,
          responseId: mockResponseId,
          surveyId: mockSurveyId,
        },
        "Error checking quotas full"
      );
    });

    test("should handle updateResponse errors gracefully", async () => {
      vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValueOnce([
        { quotaId: mockQuotaId, _count: { responseId: 50 } } as any, // mockQuota at limit
        { quotaId: "quota456", _count: { responseId: 25 } } as any, // mockQuota2 below limit
      ]);
      vi.mocked(updateResponse).mockRejectedValue(new Error("Update failed"));

      const result = await handleQuotas(mockSurveyId, mockResponseId, mockResult, true, mockTx);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        {
          error: expect.any(Error),
          responseId: mockResponseId,
          surveyId: mockSurveyId,
        },
        "Error checking quotas full"
      );
    });

    test("should handle empty passed quotas", async () => {
      const emptyResult = {
        passedQuotas: [],
        failedQuotas: [mockQuota],
      };

      const result = await handleQuotas(mockSurveyId, mockResponseId, emptyResult, true, mockTx);

      expect(result).toBeNull();
      expect(mockTx.responseQuotaLink.groupBy).not.toHaveBeenCalled();
    });

    test("should handle quota limit exactly equal to screened in count", async () => {
      vi.mocked(mockTx.responseQuotaLink.groupBy).mockResolvedValueOnce([
        { quotaId: mockQuotaId, _count: { responseId: 50 } } as any, // mockQuota exactly at limit
        { quotaId: "quota456", _count: { responseId: 25 } } as any, // mockQuota2 below limit
      ]);

      const result = await handleQuotas(mockSurveyId, mockResponseId, mockResult, true, mockTx);

      expect(result).toEqual(mockQuota);
    });
  });
});
