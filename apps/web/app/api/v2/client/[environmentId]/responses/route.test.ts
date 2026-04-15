import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";

const {
  mockCheckSurveyValidity,
  mockCreateQuotaFullObject,
  mockCreateResponseWithQuotaEvaluation,
  mockScheduleResponsePipelineEvents,
  mockFormatValidationErrorsForV1Api,
  mockGetClientIpFromHeaders,
  mockGetElementsFromBlocks,
  mockGetIsContactsEnabled,
  mockGetOrganizationIdFromEnvironmentId,
  mockGetSurvey,
  mockHeaders,
  mockLoggerError,
  mockTransformErrorToDetails,
  mockValidateFileUploads,
  mockValidateOtherOptionLengthForMultipleChoice,
  mockValidateResponseData,
} = vi.hoisted(() => ({
  mockCheckSurveyValidity: vi.fn(),
  mockCreateQuotaFullObject: vi.fn(),
  mockCreateResponseWithQuotaEvaluation: vi.fn(),
  mockScheduleResponsePipelineEvents: vi.fn(),
  mockFormatValidationErrorsForV1Api: vi.fn(),
  mockGetClientIpFromHeaders: vi.fn(),
  mockGetElementsFromBlocks: vi.fn(),
  mockGetIsContactsEnabled: vi.fn(),
  mockGetOrganizationIdFromEnvironmentId: vi.fn(),
  mockGetSurvey: vi.fn(),
  mockHeaders: vi.fn(),
  mockLoggerError: vi.fn(),
  mockTransformErrorToDetails: vi.fn(),
  mockValidateFileUploads: vi.fn(),
  mockValidateOtherOptionLengthForMultipleChoice: vi.fn(),
  mockValidateResponseData: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@/app/api/v2/client/[environmentId]/responses/lib/utils", () => ({
  checkSurveyValidity: mockCheckSurveyValidity,
}));

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    badRequestResponse: vi.fn((message: string, details?: unknown) =>
      Response.json({ details, message }, { status: 400 })
    ),
    forbiddenResponse: vi.fn((message: string) => Response.json({ message }, { status: 403 })),
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

vi.mock("@/app/lib/pipelines", () => ({
  scheduleResponsePipelineEvents: mockScheduleResponsePipelineEvents,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mockGetSurvey,
}));

vi.mock("@/lib/survey/utils", () => ({
  getElementsFromBlocks: mockGetElementsFromBlocks,
}));

vi.mock("@/lib/utils/client-ip", () => ({
  getClientIpFromHeaders: mockGetClientIpFromHeaders,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromEnvironmentId: mockGetOrganizationIdFromEnvironmentId,
}));

vi.mock("@/modules/api/lib/validation", () => ({
  formatValidationErrorsForV1Api: mockFormatValidationErrorsForV1Api,
  validateResponseData: mockValidateResponseData,
}));

vi.mock("@/modules/api/v2/lib/element", () => ({
  validateOtherOptionLengthForMultipleChoice: mockValidateOtherOptionLengthForMultipleChoice,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mockGetIsContactsEnabled,
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
  createResponseWithQuotaEvaluation: mockCreateResponseWithQuotaEvaluation,
}));

type PostHandler = (
  request: NextRequest,
  context: { params: Promise<{ environmentId: string }> }
) => Promise<Response>;

const environmentId = "cm9environment000108l4abcz12";
const surveyId = "cm9survey000108l4abcz12zz";

const createRequest = (body: BodyInit, headers?: HeadersInit) =>
  new NextRequest(`http://localhost/api/v2/client/${environmentId}/responses`, {
    body,
    headers: {
      "content-type": "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      ...headers,
    },
    method: "POST",
  });

describe("POST /api/v2/client/[environmentId]/responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockHeaders.mockResolvedValue(new Headers({ "CF-IPCountry": "RO" }));
    mockTransformErrorToDetails.mockReturnValue([{ field: "body", message: "invalid" }]);
    mockGetOrganizationIdFromEnvironmentId.mockResolvedValue("org_1");
    mockGetIsContactsEnabled.mockResolvedValue(true);
    mockGetSurvey.mockResolvedValue({
      blocks: [],
      environmentId,
      id: surveyId,
      isCaptureIpEnabled: true,
      questions: [],
    });
    mockCheckSurveyValidity.mockResolvedValue(null);
    mockGetElementsFromBlocks.mockReturnValue([]);
    mockValidateFileUploads.mockReturnValue(true);
    mockValidateOtherOptionLengthForMultipleChoice.mockReturnValue(undefined);
    mockValidateResponseData.mockReturnValue(null);
    mockFormatValidationErrorsForV1Api.mockReturnValue([{ field: "data", message: "invalid" }]);
    mockGetClientIpFromHeaders.mockResolvedValue("203.0.113.10");
    mockCreateResponseWithQuotaEvaluation.mockResolvedValue({
      finished: true,
      id: "resp_1",
      quotaFull: { quotaId: "quota_1" },
      surveyId,
    });
    mockCreateQuotaFullObject.mockReturnValue({ quotaReached: false });
  });

  test("returns a bad request response for invalid JSON bodies", async () => {
    const { POST } = await import("./route");
    const response = await (POST as PostHandler)(createRequest("{"), {
      params: Promise.resolve({ environmentId }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Invalid JSON in request body",
    });
    expect(mockGetSurvey).not.toHaveBeenCalled();
  });

  test("returns forbidden when contacts are disabled for identified responses", async () => {
    mockGetIsContactsEnabled.mockResolvedValue(false);

    const { POST } = await import("./route");
    const response = await (POST as PostHandler)(
      createRequest(
        JSON.stringify({
          contactId: "cm9contact000108l4contact1",
          data: {},
          finished: false,
          surveyId,
        })
      ),
      {
        params: Promise.resolve({ environmentId }),
      }
    );

    expect(response.status).toBe(403);
    expect(mockCreateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("returns the survey validity error response when the survey check fails", async () => {
    mockCheckSurveyValidity.mockResolvedValue(
      Response.json({ message: "Survey is part of another environment" }, { status: 400 })
    );

    const { POST } = await import("./route");
    const response = await (POST as PostHandler)(
      createRequest(
        JSON.stringify({
          data: {},
          finished: false,
          surveyId,
        })
      ),
      {
        params: Promise.resolve({ environmentId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Survey is part of another environment",
    });
    expect(mockCreateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("returns a bad request response when an other-option answer exceeds the limit", async () => {
    mockValidateOtherOptionLengthForMultipleChoice.mockReturnValue("question_other");

    const { POST } = await import("./route");
    const response = await (POST as PostHandler)(
      createRequest(
        JSON.stringify({
          data: { question_other: "value" },
          finished: false,
          surveyId,
        })
      ),
      {
        params: Promise.resolve({ environmentId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      details: { questionId: "question_other" },
      message: "Response exceeds character limit",
    });
  });

  test("returns a bad request response for invalid file uploads", async () => {
    mockValidateFileUploads.mockReturnValue(false);

    const { POST } = await import("./route");
    const response = await (POST as PostHandler)(
      createRequest(
        JSON.stringify({
          data: { fileQuestion: ["invalid"] },
          finished: false,
          surveyId,
        })
      ),
      {
        params: Promise.resolve({ environmentId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Invalid file upload response",
    });
    expect(mockCreateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("returns a validation response when the response payload is invalid", async () => {
    mockValidateResponseData.mockReturnValue([{ field: "question_1", message: "invalid" }]);

    const { POST } = await import("./route");
    const response = await (POST as PostHandler)(
      createRequest(
        JSON.stringify({
          data: { question_1: "bad" },
          finished: false,
          surveyId,
        })
      ),
      {
        params: Promise.resolve({ environmentId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      details: [{ field: "data", message: "invalid" }],
      message: "Validation failed",
    });
  });

  test("returns a bad request response when response creation fails with invalid input", async () => {
    mockCreateResponseWithQuotaEvaluation.mockRejectedValue(new InvalidInputError("Bad response input"));

    const { POST } = await import("./route");
    const response = await (POST as PostHandler)(
      createRequest(
        JSON.stringify({
          data: { question_1: "hello" },
          finished: false,
          surveyId,
        })
      ),
      {
        params: Promise.resolve({ environmentId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Bad response input",
    });
  });

  test("creates the response, enriches metadata, and enqueues BullMQ events", async () => {
    const { POST } = await import("./route");
    const response = await (POST as PostHandler)(
      createRequest(
        JSON.stringify({
          data: { question_1: "hello" },
          finished: true,
          meta: {
            action: "submit",
            source: "link",
            url: "https://example.com/form",
          },
          surveyId,
        })
      ),
      {
        params: Promise.resolve({ environmentId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "resp_1",
      quotaReached: false,
    });
    expect(mockCreateResponseWithQuotaEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentId,
        meta: {
          action: "submit",
          country: "RO",
          ipAddress: "203.0.113.10",
          source: "link",
          url: "https://example.com/form",
          userAgent: {
            browser: "Chrome",
            device: "desktop",
            os: "macOS",
          },
        },
        surveyId,
      })
    );
    expect(mockScheduleResponsePipelineEvents).toHaveBeenCalledWith({
      environmentId,
      events: ["responseCreated", "responseFinished"],
      response: expect.objectContaining({
        id: "resp_1",
        surveyId,
      }),
      responseId: "resp_1",
      surveyId,
    });
  });
});
