import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockCreateQuotaFullObject,
  mockCreateResponseWithQuotaEvaluation,
  mockEnqueueResponsePipelineEvents,
  mockFormatValidationErrorsForV1Api,
  mockGetClientIpFromHeaders,
  mockGetIsContactsEnabled,
  mockGetOrganizationIdFromEnvironmentId,
  mockGetSurvey,
  mockHeaders,
  mockLoggerError,
  mockTransformErrorToDetails,
  mockValidateFileUploads,
  mockValidateResponseData,
} = vi.hoisted(() => ({
  mockCreateQuotaFullObject: vi.fn(),
  mockCreateResponseWithQuotaEvaluation: vi.fn(),
  mockEnqueueResponsePipelineEvents: vi.fn(),
  mockFormatValidationErrorsForV1Api: vi.fn(),
  mockGetClientIpFromHeaders: vi.fn(),
  mockGetIsContactsEnabled: vi.fn(),
  mockGetOrganizationIdFromEnvironmentId: vi.fn(),
  mockGetSurvey: vi.fn(),
  mockHeaders: vi.fn(),
  mockLoggerError: vi.fn(),
  mockTransformErrorToDetails: vi.fn(),
  mockValidateFileUploads: vi.fn(),
  mockValidateResponseData: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
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

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));

vi.mock("@/app/lib/pipelines", () => ({
  enqueueResponsePipelineEvents: mockEnqueueResponsePipelineEvents,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mockGetSurvey,
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

type PostHandler = (args: {
  props: { params: Promise<{ environmentId: string }> };
  req: NextRequest;
}) => Promise<{ response: Response }>;

const environmentId = "cm9environment000108l4abcz12";
const surveyId = "cm9survey000108l4abcz12zz";

const createRequest = (body: BodyInit, headers?: HeadersInit) =>
  new NextRequest(`http://localhost/api/v1/client/${environmentId}/responses`, {
    body,
    headers: {
      "content-type": "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      ...headers,
    },
    method: "POST",
  });

const waitForEnqueueCall = async (mockFn: ReturnType<typeof vi.fn>) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (mockFn.mock.calls.length > 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("Timed out waiting for enqueueResponsePipelineEvents to be called");
};

describe("POST /api/v1/client/[environmentId]/responses", () => {
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
    mockValidateFileUploads.mockReturnValue(true);
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
    const result = await (POST as unknown as PostHandler)({
      props: { params: Promise.resolve({ environmentId }) },
      req: createRequest("{"),
    });

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({
      message: "Invalid JSON in request body",
    });
    expect(mockGetSurvey).not.toHaveBeenCalled();
  });

  test("returns forbidden when contacts are disabled for identified responses", async () => {
    mockGetIsContactsEnabled.mockResolvedValue(false);

    const { POST } = await import("./route");
    const result = await (POST as unknown as PostHandler)({
      props: { params: Promise.resolve({ environmentId }) },
      req: createRequest(
        JSON.stringify({
          data: {},
          finished: false,
          surveyId,
          userId: "user_123",
        })
      ),
    });

    expect(result.response.status).toBe(403);
    expect(mockCreateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("returns a bad request response when the survey belongs to another environment", async () => {
    mockGetSurvey.mockResolvedValue({
      blocks: [],
      environmentId: "cm9differentenv000108l4zzz999",
      id: surveyId,
      isCaptureIpEnabled: false,
      questions: [],
    });

    const { POST } = await import("./route");
    const result = await (POST as unknown as PostHandler)({
      props: { params: Promise.resolve({ environmentId }) },
      req: createRequest(
        JSON.stringify({
          data: {},
          finished: false,
          surveyId,
        })
      ),
    });

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({
      message: "Survey is part of another environment",
    });
  });

  test("returns a bad request response for invalid file uploads", async () => {
    mockValidateFileUploads.mockReturnValue(false);

    const { POST } = await import("./route");
    const result = await (POST as unknown as PostHandler)({
      props: { params: Promise.resolve({ environmentId }) },
      req: createRequest(
        JSON.stringify({
          data: { fileQuestion: ["invalid"] },
          finished: false,
          surveyId,
        })
      ),
    });

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({
      message: "Invalid file upload response",
    });
    expect(mockCreateResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("creates the response, enriches metadata, and enqueues BullMQ events", async () => {
    const { POST } = await import("./route");
    const result = await (POST as unknown as PostHandler)({
      props: { params: Promise.resolve({ environmentId }) },
      req: createRequest(
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
    });

    expect(result.response.status).toBe(200);
    await expect(result.response.json()).resolves.toEqual({
      id: "resp_1",
      quotaReached: false,
    });
    expect(mockCreateResponseWithQuotaEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { question_1: "hello" },
        meta: expect.objectContaining({
          action: "submit",
          country: "RO",
          ipAddress: "203.0.113.10",
          source: "link",
          url: "https://example.com/form",
          userAgent: expect.any(Object),
        }),
        surveyId,
      })
    );
    expect(mockEnqueueResponsePipelineEvents).toHaveBeenCalledWith({
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

  test("waits for the enqueue attempt before returning the create response", async () => {
    let resolveEnqueue: (() => void) | undefined;
    const enqueuePromise = new Promise<void>((resolve) => {
      resolveEnqueue = resolve;
    });
    mockEnqueueResponsePipelineEvents.mockReturnValue(enqueuePromise);

    const { POST } = await import("./route");

    let settled = false;
    const resultPromise = (POST as unknown as PostHandler)({
      props: { params: Promise.resolve({ environmentId }) },
      req: createRequest(
        JSON.stringify({
          data: { question_1: "hello" },
          finished: true,
          surveyId,
        })
      ),
    }).then((result) => {
      settled = true;
      return result;
    });

    await waitForEnqueueCall(mockEnqueueResponsePipelineEvents);
    expect(settled).toBe(false);

    resolveEnqueue?.();

    const result = await resultPromise;
    expect(result.response.status).toBe(200);
  });
});
