import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockAuthenticatedApiClient,
  mockCreateResponseWithQuotaEvaluation,
  mockCreatedResponse,
  mockFormatValidationErrorsForV2Api,
  mockGetResponseSnapshotForPipeline,
  mockGetSurveyQuestions,
  mockHandleApiError,
  mockHasPermission,
  mockGetWorkspaceId,
  mockSendToPipeline,
  mockValidateFileUploads,
  mockValidateOtherOptionLengthForMultipleChoice,
  mockValidateResponseData,
} = vi.hoisted(() => ({
  mockAuthenticatedApiClient: vi.fn(),
  mockCreateResponseWithQuotaEvaluation: vi.fn(),
  mockCreatedResponse: vi.fn(),
  mockFormatValidationErrorsForV2Api: vi.fn(),
  mockGetResponseSnapshotForPipeline: vi.fn(),
  mockGetSurveyQuestions: vi.fn(),
  mockHandleApiError: vi.fn(),
  mockHasPermission: vi.fn(),
  mockGetWorkspaceId: vi.fn(),
  mockSendToPipeline: vi.fn(),
  mockValidateFileUploads: vi.fn(),
  mockValidateOtherOptionLengthForMultipleChoice: vi.fn(),
  mockValidateResponseData: vi.fn(),
}));

vi.mock("@/app/lib/pipelines", () => ({
  sendToPipeline: mockSendToPipeline,
}));

vi.mock("@/modules/api/lib/validation", () => ({
  formatValidationErrorsForV2Api: mockFormatValidationErrorsForV2Api,
  validateResponseData: mockValidateResponseData,
}));

vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({
  authenticatedApiClient: mockAuthenticatedApiClient,
}));

vi.mock("@/modules/api/v2/lib/element", () => ({
  validateOtherOptionLengthForMultipleChoice: mockValidateOtherOptionLengthForMultipleChoice,
}));

vi.mock("@/modules/api/v2/lib/response", () => ({
  responses: {
    createdResponse: mockCreatedResponse,
    successResponse: vi.fn(),
  },
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  handleApiError: mockHandleApiError,
}));

vi.mock("@/modules/api/v2/management/lib/helper", () => ({
  getWorkspaceId: mockGetWorkspaceId,
}));

vi.mock("@/modules/api/v2/management/responses/[responseId]/lib/survey", () => ({
  getSurveyQuestions: mockGetSurveyQuestions,
}));

vi.mock("@/modules/api/v2/management/responses/[responseId]/lib/response", () => ({
  getResponseForPipeline: mockGetResponseSnapshotForPipeline,
}));

vi.mock("@/modules/organization/settings/api-keys/lib/utils", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: vi.fn((value) => value),
  validateFileUploads: mockValidateFileUploads,
}));

vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: mockCreateResponseWithQuotaEvaluation,
  getResponses: vi.fn(),
}));

const workspaceId = "cm9workspace000108l4abcz12";
const surveyId = "cm9survey000108l4abcz12zz";
const responseId = "cm9response000108l4abcz12";
const createdAt = new Date("2026-04-13T10:00:00.000Z");

const createdResponse = {
  contactAttributes: null,
  contactId: null,
  createdAt,
  data: {},
  displayId: null,
  endingId: null,
  finished: true,
  id: responseId,
  language: null,
  meta: {},
  singleUseId: null,
  surveyId,
  ttc: {},
  updatedAt: createdAt,
  variables: {},
};

const responseSnapshot = {
  contact: null,
  contactAttributes: null,
  createdAt,
  data: {},
  displayId: null,
  endingId: null,
  finished: true,
  id: responseId,
  language: null,
  meta: {},
  singleUseId: null,
  surveyId,
  tags: [],
  ttc: {},
  updatedAt: createdAt,
  variables: {},
};

describe("POST /modules/api/v2/management/responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }) =>
        await handler({
          auditLog: undefined,
          authentication: {
            workspacePermissions: [{ workspaceId, actions: ["POST"] }],
          },
          parsedInput: {
            body: {
              data: {},
              finished: true,
              surveyId,
            },
          },
        })
    );
    mockGetWorkspaceId.mockResolvedValue({ data: { workspaceId }, ok: true });
    mockHasPermission.mockReturnValue(true);
    mockGetSurveyQuestions.mockResolvedValue({ data: { blocks: [], questions: [] }, ok: true });
    mockValidateFileUploads.mockReturnValue(true);
    mockValidateOtherOptionLengthForMultipleChoice.mockReturnValue(undefined);
    mockValidateResponseData.mockReturnValue(null);
    mockCreateResponseWithQuotaEvaluation.mockResolvedValue({ data: createdResponse, ok: true });
    mockGetResponseSnapshotForPipeline.mockResolvedValue({ data: responseSnapshot, ok: true });
    mockCreatedResponse.mockImplementation((body: unknown) => Response.json(body, { status: 201 }));
    mockHandleApiError.mockImplementation((_, error) => Response.json({ error }, { status: 400 }));
  });

  test("passes the freshly hydrated response snapshot to the pipeline scheduler", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v2/management/responses", { method: "POST" })
    );

    expect(response.status).toBe(201);
    expect(mockGetResponseSnapshotForPipeline).toHaveBeenCalledWith(responseId);
    expect(mockSendToPipeline).toHaveBeenNthCalledWith(1, {
      event: "responseCreated",
      workspaceId,
      response: responseSnapshot,
      surveyId,
    });
    expect(mockSendToPipeline).toHaveBeenNthCalledWith(2, {
      event: "responseFinished",
      workspaceId,
      response: responseSnapshot,
      surveyId,
    });
  });
});
