import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockCreateResponseWithQuotaEvaluation,
  mockGetSurvey,
  mockHasPermission,
  mockParseJsonBodyWithLimit,
  mockResolveBodyIds,
  mockSendToPipeline,
  mockValidateClientFileUploads,
  mockValidateResponseData,
} = vi.hoisted(() => ({
  mockCreateResponseWithQuotaEvaluation: vi.fn(),
  mockGetSurvey: vi.fn(),
  mockHasPermission: vi.fn(),
  mockParseJsonBodyWithLimit: vi.fn(),
  mockResolveBodyIds: vi.fn(),
  mockSendToPipeline: vi.fn(),
  mockValidateClientFileUploads: vi.fn(),
  mockValidateResponseData: vi.fn(),
}));

// The wrapper only needs to invoke the handler with a fixed authenticated principal for these tests.
vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: (params: { handler: (ctx: unknown) => Promise<{ response: Response }> }) => {
    return async (req: unknown) => {
      const result = await params.handler({
        req,
        auditLog: {},
        authentication: { apiKeyId: "apikey_1", workspacePermissions: [] },
      });
      return result.response;
    };
  },
}));

vi.mock("@/app/api/v1/management/lib/workspace-resolver", () => ({
  resolveBodyIds: mockResolveBodyIds,
}));

vi.mock("@/app/lib/api/request-body", () => ({
  parseJsonBodyWithLimit: mockParseJsonBodyWithLimit,
  RequestBodyTooLargeError: class RequestBodyTooLargeError extends Error {},
}));

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    badRequestResponse: vi.fn((message: string) => Response.json({ message }, { status: 400 })),
    successResponse: vi.fn((data: unknown) => Response.json({ data }, { status: 200 })),
    notAuthenticatedResponse: vi.fn(() => new Response(null, { status: 401 })),
    unauthorizedResponse: vi.fn(() => new Response(null, { status: 403 })),
    payloadTooLargeResponse: vi.fn(() => new Response(null, { status: 413 })),
  },
}));

vi.mock("@/app/lib/api/validator", () => ({ transformErrorToDetails: vi.fn(() => ({})) }));

vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: mockSendToPipeline }));

vi.mock("@/lib/survey/service", () => ({ getSurvey: mockGetSurvey }));

vi.mock("@/modules/api/lib/validation", () => ({
  formatValidationErrorsForV1Api: vi.fn(() => ({})),
  validateResponseData: mockValidateResponseData,
}));

vi.mock("@/modules/organization/settings/api-keys/lib/utils", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: vi.fn((value) => value),
  validateClientFileUploads: mockValidateClientFileUploads,
}));

vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: mockCreateResponseWithQuotaEvaluation,
  getResponses: vi.fn(),
  getResponsesByWorkspaceIds: vi.fn(),
}));

const workspaceId = "cm9workspace000108l4abcz12";
const surveyId = "cm9survey000108l4abcz12zz";
const elementId = "cm9element000108l4abcz12zz";

const buildRequest = () =>
  new Request("http://localhost/api/v1/management/responses", { method: "POST" }) as never;

describe("POST /api/v1/management/responses file-upload authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const body = {
      workspaceId,
      surveyId,
      finished: false,
      data: {
        [elementId]: [
          `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${elementId}/report--fid--abc.pdf`,
        ],
      },
    };

    mockParseJsonBodyWithLimit.mockResolvedValue(body);
    mockResolveBodyIds.mockResolvedValue({ ok: true, body, alreadyAuthorized: true });
    // Survey-authoritative workspace id equals the request-body one (validateSurvey passes).
    mockGetSurvey.mockResolvedValue({ id: surveyId, workspaceId, questions: [], blocks: [] });
    mockValidateResponseData.mockReturnValue(null);
  });

  test("passes the survey-authoritative workspace and survey ids to the file-upload validator", async () => {
    // Reject so the handler returns immediately after the file-upload check — the assertion is on
    // the arguments the route hands the validator, not the downstream create path.
    mockValidateClientFileUploads.mockReturnValue(false);

    const { POST } = await import("./route");
    const response = await POST(buildRequest(), {} as never);

    expect(response.status).toBe(400);
    expect(mockValidateClientFileUploads).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, surveyId })
    );
  });

  test("does not reject a response whose file upload the validator accepts", async () => {
    mockValidateClientFileUploads.mockReturnValue(true);
    mockCreateResponseWithQuotaEvaluation.mockResolvedValue({ id: "response_1", surveyId, finished: false });

    const { POST } = await import("./route");
    const response = await POST(buildRequest(), {} as never);

    expect(response.status).toBe(200);
    expect(mockValidateClientFileUploads).toHaveBeenCalledTimes(1);
  });
});
