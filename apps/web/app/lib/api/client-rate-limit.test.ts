import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  applyClientRateLimit: vi.fn(),
  reportApiError: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyClientRateLimit: mocks.applyClientRateLimit,
}));

vi.mock("@/app/lib/api/api-error-reporter", () => ({
  reportApiError: mocks.reportApiError,
}));

const environmentId = "ck12345678901234567890123";

describe("client-rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyClientRateLimit.mockResolvedValue({ allowed: true });
  });

  test("applies the client rate limit for a valid environment ID", async () => {
    const request = new Request(`https://api.test/api/v2/client/${environmentId}/displays`);

    const { applyClientApiRateLimit } = await import("./client-rate-limit");
    const response = await applyClientApiRateLimit({ request, environmentId });

    expect(response).toBeNull();
    expect(mocks.applyClientRateLimit).toHaveBeenCalledWith(environmentId, undefined);
  });

  test("passes custom configs to the client rate limit helper", async () => {
    const request = new Request(`https://api.test/api/v2/client/${environmentId}/storage`);
    const customRateLimitConfig = {
      interval: 60,
      allowedPerInterval: 5,
      namespace: "storage:upload",
    };

    const { applyClientApiRateLimit } = await import("./client-rate-limit");
    const response = await applyClientApiRateLimit({
      request,
      environmentId,
      customRateLimitConfig,
    });

    expect(response).toBeNull();
    expect(mocks.applyClientRateLimit).toHaveBeenCalledWith(environmentId, customRateLimitConfig);
  });

  test("rejects invalid environment IDs before touching Redis", async () => {
    const request = new Request("https://api.test/api/v2/client/not-a-cuid/displays");

    const { applyClientApiRateLimit } = await import("./client-rate-limit");
    const response = await applyClientApiRateLimit({ request, environmentId: "not-a-cuid" });

    expect(response?.status).toBe(400);
    expect(await response?.json()).toEqual({
      code: "bad_request",
      message: "Invalid environment ID format",
      details: {},
    });
    expect(mocks.applyClientRateLimit).not.toHaveBeenCalled();
  });

  test("returns 429 for TooManyRequestsError without reporting an internal error", async () => {
    const request = new Request(`https://api.test/api/v2/client/${environmentId}/responses`);
    mocks.applyClientRateLimit.mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached. Please try again later.")
    );

    const { applyClientApiRateLimit } = await import("./client-rate-limit");
    const response = await applyClientApiRateLimit({ request, environmentId });

    expect(response?.status).toBe(429);
    expect(await response?.json()).toEqual({
      code: "too_many_requests",
      message: "Maximum number of requests reached. Please try again later.",
      details: {},
    });
    expect(mocks.reportApiError).not.toHaveBeenCalled();
  });

  test("returns a generic 500 and reports unexpected rate limit failures", async () => {
    const request = new Request(`https://api.test/api/v2/client/${environmentId}/responses`);
    const underlyingError = new Error("Failed to hash IP");
    mocks.applyClientRateLimit.mockRejectedValue(underlyingError);

    const { applyClientApiRateLimit } = await import("./client-rate-limit");
    const response = await applyClientApiRateLimit({ request, environmentId });

    expect(response?.status).toBe(500);
    expect(await response?.json()).toEqual({
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
});
