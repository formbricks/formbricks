import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TResponse, TResponseInput } from "@formbricks/types/responses";
import { updateResponse } from "@/lib/response/service";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
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
  const mockResponseId = "response123";
  const mockResponseInput: Partial<TResponseInput> = {
    data: { question1: "answer1" },
    finished: true,
    language: "en",
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
    contact: {
      id: "contact123",
      userId: "user123",
    },
    tags: [
      {
        id: "tag123",
        name: "important",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        environmentId: "env123",
      },
    ],
  };

  const mockRefreshedResponse = {
    id: "response123",
    surveyId: "survey123",
    finished: true,
    data: { question1: "updated_answer" },
    meta: {},
    ttc: {},
    variables: { var1: "updated_value" },
    contactAttributes: {},
    singleUseId: null,
    language: "en",
    displayId: null,
    endingId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-02"),
    contactId: "contact123",
    contact: mockResponse.contact,
    tags: mockResponse.tags,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = {
      response: {
        update: vi.fn(),
      },
    };
    prisma.$transaction = vi.fn(async (cb: any) => cb(mockTx));
  });

  test("should return original response when quota doesn't end survey", async () => {
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
  });

  test("should return refreshed response when quota ends survey and refreshedResponse exists", async () => {
    mockUpdateResponse.mockResolvedValue(mockResponse);
    mockEvaluateResponseQuotas.mockResolvedValue({
      shouldEndSurvey: true,
      refreshedResponse: mockRefreshedResponse,
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
      ...mockRefreshedResponse,
      tags: mockResponse.tags,
      contact: mockResponse.contact,
    });
  });

  test("should return original response when quota ends survey but no refreshedResponse", async () => {
    mockUpdateResponse.mockResolvedValue(mockResponse);
    mockEvaluateResponseQuotas.mockResolvedValue({
      shouldEndSurvey: true,
      refreshedResponse: null,
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
  });

  test("should return original response when quota ends survey but refreshedResponse is undefined", async () => {
    mockUpdateResponse.mockResolvedValue(mockResponse);
    mockEvaluateResponseQuotas.mockResolvedValue({
      shouldEndSurvey: true,
      refreshedResponse: undefined,
    });

    const result = await updateResponseWithQuotaEvaluation(mockResponseId, mockResponseInput);

    expect(mockUpdateResponse).toHaveBeenCalledWith(mockResponseId, mockResponseInput, mockTx);
    expect(result).toEqual(mockResponse);
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
