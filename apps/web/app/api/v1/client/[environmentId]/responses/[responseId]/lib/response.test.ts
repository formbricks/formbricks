import { updateResponse } from "@/lib/response/service";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponse } from "@formbricks/types/responses";
import { updateResponseWithQuotaEvaluation } from "./response";

vi.mock("@/lib/response/service");
vi.mock("@/modules/ee/quotas/lib/evaluation-service");

const mockUpdateResponse = vi.mocked(updateResponse);
const mockEvaluateResponseQuotas = vi.mocked(evaluateResponseQuotas);

type MockTx = {
  response: {
    update: ReturnType<typeof vi.fn>;
  };
};
let mockTx: MockTx;

describe("updateResponseWithQuotaEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockTx = {
      response: {
        update: vi.fn(),
      },
    };
    prisma.$transaction = vi.fn(async (cb: any) => cb(mockTx));
  });

  const mockResponseId = "response123";
  const mockResponseInput = {
    data: { question1: "answer1" },
    finished: true,
  };

  const mockResponse: TResponse = {
    id: "response123",
    surveyId: "survey123",
    finished: true,
    data: { question1: "answer1" },
    meta: {},
    ttc: {},
    variables: { var1: "value1" },
    contactAttributes: {},
    singleUseId: null,
    language: "en",
    displayId: null,
    endingId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    contact: null,
    tags: [],
  };

  const mockQuotaFull: TSurveyQuota = {
    id: "quota123",
    surveyId: "survey123",
    name: "Test Quota",
    action: "endSurvey",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    countPartialSubmissions: false,
    endingCardId: null,
    limit: 100,
    logic: {
      connector: "and",
      conditions: [],
    },
  };

  test("should return response with quotaFull when quota evaluation returns quotaFull", async () => {
    mockUpdateResponse.mockResolvedValue(mockResponse);
    mockEvaluateResponseQuotas.mockResolvedValue({
      quotaFull: mockQuotaFull,
      shouldEndSurvey: true,
    });

    const result = await updateResponseWithQuotaEvaluation(mockResponseId, mockResponseInput);

    expect(mockUpdateResponse).toHaveBeenCalledWith(mockResponseId, mockResponseInput, mockTx);
    expect(mockEvaluateResponseQuotas).toHaveBeenCalledWith({
      surveyId: mockResponse.surveyId,
      responseId: mockResponse.id,
      data: mockResponse.data,
      variables: mockResponse.variables,
      language: mockResponse.language,
      responseFinished: mockResponse.finished,
      tx: mockTx,
    });

    expect(result).toEqual({
      ...mockResponse,
      quotaFull: mockQuotaFull,
    });
  });

  test("should return response without quotaFull when quota evaluation returns no quotaFull", async () => {
    mockUpdateResponse.mockResolvedValue(mockResponse);
    mockEvaluateResponseQuotas.mockResolvedValue({
      shouldEndSurvey: false,
    });

    const result = await updateResponseWithQuotaEvaluation(mockResponseId, mockResponseInput);

    expect(mockUpdateResponse).toHaveBeenCalledWith(mockResponseId, mockResponseInput, mockTx);
    expect(mockEvaluateResponseQuotas).toHaveBeenCalledWith({
      surveyId: mockResponse.surveyId,
      responseId: mockResponse.id,
      data: mockResponse.data,
      variables: mockResponse.variables,
      language: mockResponse.language,
      responseFinished: mockResponse.finished,
      tx: mockTx,
    });

    expect(result).toEqual(mockResponse);
    expect(result).not.toHaveProperty("quotaFull");
  });

  test("should use default language when response language is null", async () => {
    const responseWithNullLanguage = { ...mockResponse, language: null };
    mockUpdateResponse.mockResolvedValue(responseWithNullLanguage);
    mockEvaluateResponseQuotas.mockResolvedValue({
      shouldEndSurvey: false,
    });

    const result = await updateResponseWithQuotaEvaluation(mockResponseId, mockResponseInput);

    expect(mockEvaluateResponseQuotas).toHaveBeenCalledWith({
      surveyId: responseWithNullLanguage.surveyId,
      responseId: responseWithNullLanguage.id,
      data: responseWithNullLanguage.data,
      variables: responseWithNullLanguage.variables,
      language: "default",
      responseFinished: responseWithNullLanguage.finished,
      tx: mockTx,
    });

    expect(result).toEqual(responseWithNullLanguage);
  });
});
