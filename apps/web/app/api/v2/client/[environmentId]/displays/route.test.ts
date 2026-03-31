import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDisplay: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  getOrganizationIdFromEnvironmentId: vi.fn(),
  reportApiError: vi.fn(),
}));

vi.mock("./lib/display", () => ({
  createDisplay: mocks.createDisplay,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromEnvironmentId: mocks.getOrganizationIdFromEnvironmentId,
}));

vi.mock("@/app/lib/api/api-error-reporter", () => ({
  reportApiError: mocks.reportApiError,
}));

const environmentId = "cld1234567890abcdef123456";
const surveyId = "clg123456789012345678901234";

describe("api/v2 client displays route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationIdFromEnvironmentId.mockResolvedValue("org_123");
    mocks.getIsContactsEnabled.mockResolvedValue(true);
  });

  test("returns a v2 bad request response for malformed JSON without reporting an internal error", async () => {
    const request = new Request(`https://api.test/api/v2/client/${environmentId}/displays`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{",
    });

    const { POST } = await import("./route");
    const response = await POST(request, {
      params: Promise.resolve({ environmentId }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        code: "bad_request",
        message: "Invalid JSON in request body",
      })
    );
    expect(mocks.createDisplay).not.toHaveBeenCalled();
    expect(mocks.reportApiError).not.toHaveBeenCalled();
  });

  test("reports unexpected createDisplay failures while keeping the response payload unchanged", async () => {
    const underlyingError = new Error("display persistence failed");
    mocks.createDisplay.mockRejectedValue(underlyingError);

    const request = new Request(`https://api.test/api/v2/client/${environmentId}/displays`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId,
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
  });

  test("reports unexpected contact-license lookup failures with the same generic public response", async () => {
    const underlyingError = new Error("license lookup failed");
    mocks.getOrganizationIdFromEnvironmentId.mockRejectedValue(underlyingError);

    const request = new Request(`https://api.test/api/v2/client/${environmentId}/displays`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId,
        contactId: "clh123456789012345678901234",
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
    expect(mocks.createDisplay).not.toHaveBeenCalled();
  });
});
