import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockCreateQuotaFullObject,
  mockEnqueueResponsePipelineEvents,
  mockFormatValidationErrorsForV1Api,
  mockGetResponse,
  mockGetSurvey,
  mockLoggerError,
  mockTransformErrorToDetails,
  mockUpdateResponseWithQuotaEvaluation,
  mockValidateFileUploads,
  mockValidateOtherOptionLengthForMultipleChoice,
  mockValidateResponseData,
} = vi.hoisted(() => ({
  mockCreateQuotaFullObject: vi.fn(),
  mockEnqueueResponsePipelineEvents: vi.fn(),
  mockFormatValidationErrorsForV1Api: vi.fn(),
  mockGetResponse: vi.fn(),
  mockGetSurvey: vi.fn(),
  mockLoggerError: vi.fn(),
  mockTransformErrorToDetails: vi.fn(),
  mockUpdateResponseWithQuotaEvaluation: vi.fn(),
  mockValidateFileUploads: vi.fn(),
  mockValidateOtherOptionLengthForMultipleChoice: vi.fn(),
  mockValidateResponseData: vi.fn(),
}));

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    badRequestResponse: vi.fn((message: string, details?: unknown) =>
      Response.json({ details, message }, { status: 400 })
    ),
    internalServerErrorResponse: vi.fn((message: string) => Response.json({ message }, { status: 500 })),
    notFoundResponse: vi.fn((resource: string, id: string) =>
      Response.json({ id, message: `${resource} not found` }, { status: 404 })
    ),
    successResponse: vi.fn((body: unknown) => Response.json(body, { status: 200 })),
  },
}));

vi.mock("@/app/lib/api/validator", () => ({
  transformErrorToDetails: mockTransformErrorToDetails,
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));

vi.mock("@/app/lib/pipelines", () => ({
  enqueueResponsePipelineEvents: mockEnqueueResponsePipelineEvents,
}));

vi.mock("@/lib/response/service", () => ({
  getResponse: mockGetResponse,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mockGetSurvey,
}));

vi.mock("@/modules/api/lib/validation", () => ({
  formatValidationErrorsForV1Api: mockFormatValidationErrorsForV1Api,
  validateResponseData: mockValidateResponseData,
}));

vi.mock("@/modules/api/v2/lib/element", () => ({
  validateOtherOptionLengthForMultipleChoice: mockValidateOtherOptionLengthForMultipleChoice,
}));

vi.mock("@/modules/ee/quotas/lib/helpers", () => ({
  createQuotaFullObject: mockCreateQuotaFullObject,
}));

vi.mock("@/modules/storage/utils", () => ({
  validateFileUploads: mockValidateFileUploads,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("./lib/response", () => ({
  updateResponseWithQuotaEvaluation: mockUpdateResponseWithQuotaEvaluation,
}));

type PutHandler = (args: {
  props: { params: Promise<{ responseId: string }> };
  req: NextRequest;
}) => Promise<{ response: Response }>;

const responseId = "cm9response000108l4abcz12";
const surveyId = "cm9survey000108l4abcz12zz";

const createRequest = (body: BodyInit) =>
  new NextRequest(`http://localhost/api/v1/client/env/responses/${responseId}`, {
    body,
    headers: {
      "content-type": "application/json",
    },
    method: "PUT",
  });

describe("PUT /api/v1/client/[environmentId]/responses/[responseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockTransformErrorToDetails.mockReturnValue([{ field: "body", message: "invalid" }]);
    mockGetResponse.mockResolvedValue({
      data: { question_1: "old" },
      finished: false,
      id: responseId,
      language: "en",
      surveyId,
    });
    mockGetSurvey.mockResolvedValue({
      blocks: [],
      environmentId: "cm9environment000108l4abcz12",
      id: surveyId,
      questions: [],
    });
    mockValidateFileUploads.mockReturnValue(true);
    mockValidateOtherOptionLengthForMultipleChoice.mockReturnValue(undefined);
    mockValidateResponseData.mockReturnValue(null);
    mockFormatValidationErrorsForV1Api.mockReturnValue([{ field: "data", message: "invalid" }]);
    mockUpdateResponseWithQuotaEvaluation.mockResolvedValue({
      finished: true,
      id: responseId,
      quotaFull: { quotaId: "quota_1" },
    });
    mockCreateQuotaFullObject.mockReturnValue({ quotaReached: true });
  });

  test("returns a bad request response when the response is already finished", async () => {
    mockGetResponse.mockResolvedValue({
      data: {},
      finished: true,
      id: responseId,
      language: "en",
      surveyId,
    });

    const { PUT } = await import("./route");
    const result = await (PUT as unknown as PutHandler)({
      props: { params: Promise.resolve({ responseId }) },
      req: createRequest(JSON.stringify({ data: {}, finished: false })),
    });

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({
      message: "Response is already finished",
    });
    expect(mockGetSurvey).not.toHaveBeenCalled();
  });

  test("returns a bad request response when the request body fails validation", async () => {
    const { PUT } = await import("./route");
    const result = await (PUT as unknown as PutHandler)({
      props: { params: Promise.resolve({ responseId }) },
      req: createRequest(JSON.stringify({ data: 123, finished: false })),
    });

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({
      message: "Fields are missing or incorrectly formatted",
    });
    expect(mockGetResponse).not.toHaveBeenCalled();
  });

  test("returns a bad request response when file uploads are invalid", async () => {
    mockValidateFileUploads.mockReturnValue(false);

    const { PUT } = await import("./route");
    const result = await (PUT as unknown as PutHandler)({
      props: { params: Promise.resolve({ responseId }) },
      req: createRequest(JSON.stringify({ data: { fileQuestion: ["invalid"] }, finished: false })),
    });

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({
      message: "Invalid file upload response",
    });
    expect(mockUpdateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("returns a bad request response when an other-option answer exceeds the limit", async () => {
    mockValidateOtherOptionLengthForMultipleChoice.mockReturnValue("question_other");

    const { PUT } = await import("./route");
    const result = await (PUT as unknown as PutHandler)({
      props: { params: Promise.resolve({ responseId }) },
      req: createRequest(JSON.stringify({ data: { question_other: "value" }, finished: false })),
    });

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({
      details: { questionId: "question_other" },
      message: "Response exceeds character limit",
    });
  });

  test("returns an internal server error response when loading the survey fails", async () => {
    const surveyError = new Error("survey lookup failed");
    mockGetSurvey.mockRejectedValue(surveyError);

    const { PUT } = await import("./route");
    const result = await (PUT as unknown as PutHandler)({
      props: { params: Promise.resolve({ responseId }) },
      req: createRequest(JSON.stringify({ data: { question_1: "new" }, finished: false })),
    });

    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toMatchObject({
      message: "Unknown error occurred",
    });
  });

  test("returns an internal server error response when persisting the update fails", async () => {
    const updateError = new Error("update failed");
    mockUpdateResponseWithQuotaEvaluation.mockRejectedValue(updateError);

    const { PUT } = await import("./route");
    const result = await (PUT as unknown as PutHandler)({
      props: { params: Promise.resolve({ responseId }) },
      req: createRequest(JSON.stringify({ data: { question_1: "new" }, finished: false })),
    });

    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toMatchObject({
      message: "Something went wrong",
    });
    expect(mockLoggerError).toHaveBeenCalledWith(
      { error: updateError, url: `http://localhost/api/v1/client/env/responses/${responseId}` },
      "Error in PUT /api/v1/client/[environmentId]/responses/[responseId]"
    );
  });

  test("updates the response and enqueues BullMQ events", async () => {
    const { PUT } = await import("./route");
    const result = await (PUT as unknown as PutHandler)({
      props: { params: Promise.resolve({ responseId }) },
      req: createRequest(JSON.stringify({ data: { question_1: "new" }, finished: true })),
    });

    expect(result.response.status).toBe(200);
    await expect(result.response.json()).resolves.toEqual({
      id: responseId,
      quotaReached: true,
    });
    expect(mockUpdateResponseWithQuotaEvaluation).toHaveBeenCalledWith(responseId, {
      data: { question_1: "new" },
      finished: true,
    });
    expect(mockEnqueueResponsePipelineEvents).toHaveBeenCalledWith({
      environmentId: "cm9environment000108l4abcz12",
      events: ["responseUpdated", "responseFinished"],
      responseId,
      surveyId,
    });
  });
});
