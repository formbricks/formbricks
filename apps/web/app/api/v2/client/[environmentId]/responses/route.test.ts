import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkSurveyValidity: vi.fn(),
  createResponseWithQuotaEvaluation: vi.fn(),
  getClientIpFromHeaders: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  getOrganizationIdFromEnvironmentId: vi.fn(),
  getSurvey: vi.fn(),
  reportApiError: vi.fn(),
  sendToPipeline: vi.fn(),
  validateResponseData: vi.fn(),
}));

vi.mock("@/app/api/v2/client/[environmentId]/responses/lib/utils", () => ({
  checkSurveyValidity: mocks.checkSurveyValidity,
}));

vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: mocks.createResponseWithQuotaEvaluation,
}));

vi.mock("@/app/lib/api/api-error-reporter", () => ({
  reportApiError: mocks.reportApiError,
}));

vi.mock("@/app/lib/pipelines", () => ({
  sendToPipeline: mocks.sendToPipeline,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mocks.getSurvey,
}));

vi.mock("@/lib/utils/client-ip", () => ({
  getClientIpFromHeaders: mocks.getClientIpFromHeaders,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromEnvironmentId: mocks.getOrganizationIdFromEnvironmentId,
}));

vi.mock("@/modules/api/lib/validation", () => ({
  formatValidationErrorsForV1Api: vi.fn((errors) => errors),
  validateResponseData: mocks.validateResponseData,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

const environmentId = "cld1234567890abcdef123456";
const surveyId = "clg123456789012345678901234";

describe("api/v2 client responses route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkSurveyValidity.mockResolvedValue(null);
    mocks.getSurvey.mockResolvedValue({
      id: surveyId,
      environmentId,
      blocks: [],
      questions: [],
      isCaptureIpEnabled: false,
    });
    mocks.validateResponseData.mockReturnValue(null);
    mocks.getOrganizationIdFromEnvironmentId.mockResolvedValue("org_123");
    mocks.getIsContactsEnabled.mockResolvedValue(true);
    mocks.getClientIpFromHeaders.mockResolvedValue("127.0.0.1");
  });

  test("reports unexpected response creation failures while keeping the public payload generic", async () => {
    const underlyingError = new Error("response persistence failed");
    mocks.createResponseWithQuotaEvaluation.mockRejectedValue(underlyingError);

    const request = new Request(`https://api.test/api/v2/client/${environmentId}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "req-v2-response",
      },
      body: JSON.stringify({
        surveyId,
        finished: false,
        data: {},
      }),
    });

    const { POST } = await import("./route");
    const response = await POST(request, {
      params: Promise.resolve({ environmentId }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "internal_server_error",
      message: "Something went wrong. Please try again.",
      details: {},
    });
    expect(mocks.reportApiError).toHaveBeenCalledWith({
      request,
      status: 500,
      error: underlyingError,
    });
    expect(mocks.sendToPipeline).not.toHaveBeenCalled();
  });

  test("reports unexpected pre-persistence failures with the same generic public response", async () => {
    const underlyingError = new Error("survey lookup failed");
    mocks.getSurvey.mockRejectedValue(underlyingError);

    const request = new Request(`https://api.test/api/v2/client/${environmentId}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "req-v2-response-pre-check",
      },
      body: JSON.stringify({
        surveyId,
        finished: false,
        data: {},
      }),
    });

    const { POST } = await import("./route");
    const response = await POST(request, {
      params: Promise.resolve({ environmentId }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "internal_server_error",
      message: "Something went wrong. Please try again.",
      details: {},
    });
    expect(mocks.reportApiError).toHaveBeenCalledWith({
      request,
      status: 500,
      error: underlyingError,
    });
    expect(mocks.createResponseWithQuotaEvaluation).not.toHaveBeenCalled();
    expect(mocks.sendToPipeline).not.toHaveBeenCalled();
  });
});
