import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { putResponseHandler } from "./put-response-handler";

const mocks = vi.hoisted(() => ({
  formatValidationErrorsForV1Api: vi.fn((errors) => errors),
  getResponse: vi.fn(),
  getSurvey: vi.fn(),
  getValidatedResponseUpdateInput: vi.fn(),
  loggerError: vi.fn(),
  sendToPipeline: vi.fn(),
  updateResponseWithQuotaEvaluation: vi.fn(),
  validateFileUploads: vi.fn(),
  validateOtherOptionLengthForMultipleChoice: vi.fn(),
  validateResponseData: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock("@/app/lib/pipelines", () => ({
  sendToPipeline: mocks.sendToPipeline,
}));

vi.mock("@/lib/response/service", () => ({
  getResponse: mocks.getResponse,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mocks.getSurvey,
}));

vi.mock("@/modules/api/lib/validation", () => ({
  formatValidationErrorsForV1Api: mocks.formatValidationErrorsForV1Api,
  validateResponseData: mocks.validateResponseData,
}));

vi.mock("@/modules/api/v2/lib/element", () => ({
  validateOtherOptionLengthForMultipleChoice: mocks.validateOtherOptionLengthForMultipleChoice,
}));

vi.mock("@/modules/storage/utils", () => ({
  validateFileUploads: mocks.validateFileUploads,
}));

vi.mock("./response", () => ({
  updateResponseWithQuotaEvaluation: mocks.updateResponseWithQuotaEvaluation,
}));

vi.mock("./validated-response-update-input", () => ({
  getValidatedResponseUpdateInput: mocks.getValidatedResponseUpdateInput,
}));

const environmentId = "environment_a";
const responseId = "response_123";
const surveyId = "survey_123";

const createRequest = () =>
  new Request(`https://api.test/api/v1/client/${environmentId}/responses/${responseId}`, {
    method: "PUT",
  });

const createHandlerParams = (params?: Partial<{ environmentId: string; responseId: string }>) =>
  ({
    req: createRequest(),
    props: {
      params: Promise.resolve({
        environmentId,
        responseId,
        ...params,
      }),
    },
  }) as never;

const getBaseResponseUpdateInput = () => ({
  data: {
    q1: "updated-answer",
  },
  language: "en",
});

const getBaseExistingResponse = () =>
  ({
    id: responseId,
    surveyId,
    data: {
      q0: "existing-answer",
    },
    finished: false,
    language: "en",
  }) as const;

const getBaseSurvey = () =>
  ({
    id: surveyId,
    environmentId,
    blocks: [],
    questions: [],
  }) as const;

const getBaseUpdatedResponse = () =>
  ({
    id: responseId,
    surveyId,
    data: {
      q0: "existing-answer",
      q1: "updated-answer",
    },
    finished: false,
    quotaFull: undefined,
  }) as const;

describe("putResponseHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getValidatedResponseUpdateInput.mockResolvedValue({
      responseUpdateInput: getBaseResponseUpdateInput(),
    });
    mocks.getResponse.mockResolvedValue(getBaseExistingResponse());
    mocks.getSurvey.mockResolvedValue(getBaseSurvey());
    mocks.updateResponseWithQuotaEvaluation.mockResolvedValue(getBaseUpdatedResponse());
    mocks.validateFileUploads.mockReturnValue(true);
    mocks.validateOtherOptionLengthForMultipleChoice.mockReturnValue(null);
    mocks.validateResponseData.mockReturnValue(null);
  });

  test("returns a bad request response when the response id is missing", async () => {
    const result = await putResponseHandler(createHandlerParams({ responseId: "" }));

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      code: "bad_request",
      message: "Response ID is missing",
      details: {},
    });
    expect(mocks.getValidatedResponseUpdateInput).not.toHaveBeenCalled();
  });

  test("returns the validation response from the parsed request input", async () => {
    const validationResponse = responses.badRequestResponse(
      "Malformed JSON in request body",
      undefined,
      true
    );
    mocks.getValidatedResponseUpdateInput.mockResolvedValue({
      response: validationResponse,
    });

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response).toBe(validationResponse);
    expect(mocks.getResponse).not.toHaveBeenCalled();
  });

  test("returns not found when the response does not exist", async () => {
    mocks.getResponse.mockResolvedValue(null);

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(404);
    await expect(result.response.json()).resolves.toEqual({
      code: "not_found",
      message: "Response not found",
      details: {
        resource_id: responseId,
        resource_type: "Response",
      },
    });
  });

  test("maps resource lookup errors to a not found response", async () => {
    mocks.getResponse.mockRejectedValue(new ResourceNotFoundError("Response", responseId));

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(404);
    await expect(result.response.json()).resolves.toEqual({
      code: "not_found",
      message: "Response not found",
      details: {
        resource_id: responseId,
        resource_type: "Response",
      },
    });
  });

  test("maps invalid lookup input errors to a bad request response", async () => {
    mocks.getResponse.mockRejectedValue(new InvalidInputError("Invalid response id"));

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      code: "bad_request",
      message: "Invalid response id",
      details: {},
    });
  });

  test("maps database lookup errors to a reported internal server error", async () => {
    const error = new DatabaseError("Lookup failed");
    mocks.getResponse.mockRejectedValue(error);

    const result = await putResponseHandler(createHandlerParams());

    expect(result.error).toBe(error);
    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      code: "internal_server_error",
      message: "Lookup failed",
      details: {},
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      {
        error,
        url: createRequest().url,
      },
      "Error in PUT /api/v1/client/[environmentId]/responses/[responseId]"
    );
  });

  test("maps unknown lookup failures to a generic internal server error", async () => {
    const error = new Error("boom");
    mocks.getResponse.mockRejectedValue(error);

    const result = await putResponseHandler(createHandlerParams());

    expect(result.error).toBe(error);
    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      code: "internal_server_error",
      message: "Unknown error occurred",
      details: {},
    });
  });

  test("rejects updates when the response survey does not belong to the requested environment", async () => {
    mocks.getSurvey.mockResolvedValue({
      ...getBaseSurvey(),
      environmentId: "different_environment",
    });

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(404);
    await expect(result.response.json()).resolves.toEqual({
      code: "not_found",
      message: "Response not found",
      details: {
        resource_id: responseId,
        resource_type: "Response",
      },
    });
    expect(mocks.updateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
    expect(mocks.sendToPipeline).not.toHaveBeenCalled();
  });

  test("rejects updates when the response is already finished", async () => {
    mocks.getResponse.mockResolvedValue({
      ...getBaseExistingResponse(),
      finished: true,
    });

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      code: "bad_request",
      message: "Response is already finished",
      details: {},
    });
    expect(mocks.updateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("rejects invalid file upload updates", async () => {
    mocks.validateFileUploads.mockReturnValue(false);

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      code: "bad_request",
      message: "Invalid file upload response",
      details: {},
    });
    expect(mocks.updateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("rejects updates when an other-option response exceeds the character limit", async () => {
    mocks.validateOtherOptionLengthForMultipleChoice.mockReturnValue("question_123");

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      code: "bad_request",
      message: "Response exceeds character limit",
      details: {
        questionId: "question_123",
      },
    });
    expect(mocks.updateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("returns validation details when merged response data is invalid", async () => {
    mocks.validateResponseData.mockReturnValue([{ field: "q1", message: "Required" }]);
    mocks.formatValidationErrorsForV1Api.mockReturnValue({
      q1: "Required",
    });

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      code: "bad_request",
      message: "Validation failed",
      details: {
        q1: "Required",
      },
    });
    expect(mocks.formatValidationErrorsForV1Api).toHaveBeenCalledWith([{ field: "q1", message: "Required" }]);
  });

  test("returns not found when the response disappears during update", async () => {
    mocks.updateResponseWithQuotaEvaluation.mockRejectedValue(
      new ResourceNotFoundError("Response", responseId)
    );

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(404);
    await expect(result.response.json()).resolves.toEqual({
      code: "not_found",
      message: "Response not found",
      details: {
        resource_id: responseId,
        resource_type: "Response",
      },
    });
  });

  test("returns a bad request response for invalid update input during persistence", async () => {
    mocks.updateResponseWithQuotaEvaluation.mockRejectedValue(
      new InvalidInputError("Response update payload is invalid")
    );

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      code: "bad_request",
      message: "Response update payload is invalid",
      details: {},
    });
  });

  test("returns a reported internal server error for database update failures", async () => {
    const error = new DatabaseError("Update failed");
    mocks.updateResponseWithQuotaEvaluation.mockRejectedValue(error);

    const result = await putResponseHandler(createHandlerParams());

    expect(result.error).toBe(error);
    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      code: "internal_server_error",
      message: "Update failed",
      details: {},
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      {
        error,
        url: createRequest().url,
      },
      "Error in PUT /api/v1/client/[environmentId]/responses/[responseId]"
    );
  });

  test("returns a generic internal server error for unexpected update failures", async () => {
    const error = new Error("Unexpected persistence failure");
    mocks.updateResponseWithQuotaEvaluation.mockRejectedValue(error);

    const result = await putResponseHandler(createHandlerParams());

    expect(result.error).toBe(error);
    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      code: "internal_server_error",
      message: "Something went wrong",
      details: {},
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      {
        error,
        url: createRequest().url,
      },
      "Error in PUT /api/v1/client/[environmentId]/responses/[responseId]"
    );
  });

  test("returns a success payload and emits a responseUpdated pipeline event", async () => {
    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(200);
    await expect(result.response.json()).resolves.toEqual({
      data: {
        id: responseId,
        quotaFull: false,
      },
    });
    expect(mocks.sendToPipeline).toHaveBeenCalledTimes(1);
    expect(mocks.sendToPipeline).toHaveBeenCalledWith({
      event: "responseUpdated",
      environmentId,
      surveyId,
      response: {
        id: responseId,
        surveyId,
        data: {
          q0: "existing-answer",
          q1: "updated-answer",
        },
        finished: false,
      },
    });
  });

  test("emits both pipeline events and includes quota metadata when the response finishes", async () => {
    mocks.updateResponseWithQuotaEvaluation.mockResolvedValue({
      ...getBaseUpdatedResponse(),
      finished: true,
      quotaFull: {
        id: "quota_123",
        action: "endSurvey",
        endingCardId: "ending_card_123",
      },
    });

    const result = await putResponseHandler(createHandlerParams());

    expect(result.response.status).toBe(200);
    await expect(result.response.json()).resolves.toEqual({
      data: {
        id: responseId,
        quotaFull: true,
        quota: {
          id: "quota_123",
          action: "endSurvey",
          endingCardId: "ending_card_123",
        },
      },
    });
    expect(mocks.sendToPipeline).toHaveBeenCalledTimes(2);
    expect(mocks.sendToPipeline).toHaveBeenNthCalledWith(1, {
      event: "responseUpdated",
      environmentId,
      surveyId,
      response: {
        id: responseId,
        surveyId,
        data: {
          q0: "existing-answer",
          q1: "updated-answer",
        },
        finished: true,
      },
    });
    expect(mocks.sendToPipeline).toHaveBeenNthCalledWith(2, {
      event: "responseFinished",
      environmentId,
      surveyId,
      response: {
        id: responseId,
        surveyId,
        data: {
          q0: "existing-answer",
          q1: "updated-answer",
        },
        finished: true,
      },
    });
  });
});
