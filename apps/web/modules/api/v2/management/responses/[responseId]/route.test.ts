import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockAuthenticatedApiClient,
  mockFormatValidationErrorsForV2Api,
  mockGetResponse,
  mockGetResponseSnapshotForPipeline,
  mockGetSurveyQuestions,
  mockHandleApiError,
  mockHasPermission,
  mockGetWorkspaceId,
  mockSendToPipeline,
  mockSuccessResponse,
  mockUpdateResponseWithQuotaEvaluation,
  mockValidateFileUploads,
  mockValidateOtherOptionLengthForMultipleChoice,
  mockValidateResponseData,
} = vi.hoisted(() => ({
  mockAuthenticatedApiClient: vi.fn(),
  mockFormatValidationErrorsForV2Api: vi.fn(),
  mockGetResponse: vi.fn(),
  mockGetResponseSnapshotForPipeline: vi.fn(),
  mockGetSurveyQuestions: vi.fn(),
  mockHandleApiError: vi.fn(),
  mockHasPermission: vi.fn(),
  mockGetWorkspaceId: vi.fn(),
  mockSendToPipeline: vi.fn(),
  mockSuccessResponse: vi.fn(),
  mockUpdateResponseWithQuotaEvaluation: vi.fn(),
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
    successResponse: mockSuccessResponse,
  },
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  handleApiError: mockHandleApiError,
}));

vi.mock("@/modules/api/v2/management/lib/helper", () => ({
  getWorkspaceId: mockGetWorkspaceId,
}));

vi.mock("@/modules/organization/settings/api-keys/lib/utils", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: vi.fn((value) => value),
  validateFileUploads: mockValidateFileUploads,
}));

vi.mock("./lib/response", () => ({
  deleteResponse: vi.fn(),
  getResponse: mockGetResponse,
  getResponseForPipeline: mockGetResponseSnapshotForPipeline,
  updateResponseWithQuotaEvaluation: mockUpdateResponseWithQuotaEvaluation,
}));

vi.mock("./lib/survey", () => ({
  getSurveyQuestions: mockGetSurveyQuestions,
}));

const workspaceId = "cm9workspace000108l4abcz12";
const surveyId = "cm9survey000108l4abcz12zz";
const responseId = "cm9response000108l4abcz12";
const updatedAt = new Date("2026-04-13T11:00:00.000Z");

const existingResponse = {
  contactAttributes: null,
  contactId: null,
  createdAt: new Date("2026-04-13T10:00:00.000Z"),
  data: {},
  displayId: null,
  endingId: null,
  finished: false,
  id: responseId,
  language: null,
  meta: {},
  singleUseId: null,
  surveyId,
  ttc: {},
  updatedAt: new Date("2026-04-13T10:00:00.000Z"),
  variables: {},
};

const updatedResponse = {
  ...existingResponse,
  finished: true,
  updatedAt,
};

const responseSnapshot = {
  contact: null,
  contactAttributes: null,
  createdAt: existingResponse.createdAt,
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
  updatedAt,
  variables: {},
};

describe("PUT /modules/api/v2/management/responses/[responseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }) =>
        await handler({
          auditLog: undefined,
          authentication: {
            workspacePermissions: [{ workspaceId, actions: ["PUT"] }],
          },
          parsedInput: {
            body: {
              data: {},
              finished: true,
            },
            params: {
              responseId,
            },
          },
        })
    );
    mockGetWorkspaceId.mockResolvedValue({ data: { workspaceId }, ok: true });
    mockHasPermission.mockReturnValue(true);
    mockGetResponse.mockResolvedValue({ data: existingResponse, ok: true });
    mockGetSurveyQuestions.mockResolvedValue({ data: { blocks: [], questions: [] }, ok: true });
    mockValidateFileUploads.mockReturnValue(true);
    mockValidateOtherOptionLengthForMultipleChoice.mockReturnValue(undefined);
    mockValidateResponseData.mockReturnValue(null);
    mockUpdateResponseWithQuotaEvaluation.mockResolvedValue({ data: updatedResponse, ok: true });
    mockGetResponseSnapshotForPipeline.mockResolvedValue({ data: responseSnapshot, ok: true });
    mockSuccessResponse.mockImplementation((body: unknown) => Response.json(body, { status: 200 }));
    mockHandleApiError.mockImplementation((_, error) => Response.json({ error }, { status: 400 }));
  });

  test("passes the updated response snapshot to the pipeline scheduler", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      new Request("http://localhost/api/v2/management/responses/resp_1", { method: "PUT" }),
      {
        params: Promise.resolve({ responseId }),
      }
    );

    expect(response.status).toBe(200);
    expect(mockGetResponseSnapshotForPipeline).toHaveBeenCalledWith(responseId);
    expect(mockSendToPipeline).toHaveBeenNthCalledWith(1, {
      event: "responseUpdated",
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
