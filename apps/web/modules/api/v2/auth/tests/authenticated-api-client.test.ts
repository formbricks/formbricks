import { beforeEach, describe, expect, test, vi } from "vitest";
import { handleApiError, logApiRequest } from "@/modules/api/v2/lib/utils";
import { apiWrapper } from "../api-wrapper";
import { authenticatedApiClient } from "../authenticated-api-client";

vi.mock("../api-wrapper", () => ({
  apiWrapper: vi.fn(),
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  handleApiError: vi.fn(),
  logApiRequest: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

describe("authenticatedApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should log request and return response", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    vi.mocked(apiWrapper).mockResolvedValue(new Response("ok", { status: 200 }));
    vi.mocked(logApiRequest).mockReturnValue();

    const handler = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const response = await authenticatedApiClient({
      request,
      handler,
    });

    expect(response.status).toBe(200);
    expect(logApiRequest).toHaveBeenCalled();
  });

  test("passes the original ApiErrorResponseV2 through to handleApiError", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });
    const apiError = {
      type: "internal_server_error",
      details: [{ field: "error", issue: "boom" }],
    } as const;
    const handledResponse = new Response("error", { status: 500 });

    vi.mocked(apiWrapper).mockRejectedValue(apiError);
    vi.mocked(handleApiError).mockReturnValue(handledResponse);

    const handler = vi.fn();
    const response = await authenticatedApiClient({
      request,
      handler,
    });

    expect(response).toBe(handledResponse);
    expect(handleApiError).toHaveBeenCalledWith(request, apiError, undefined, apiError);
  });

  test("passes unknown thrown errors to handleApiError as originalError", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });
    const thrownError = new Error("boom");
    const handledResponse = new Response("error", { status: 500 });

    vi.mocked(apiWrapper).mockRejectedValue(thrownError);
    vi.mocked(handleApiError).mockReturnValue(handledResponse);

    const handler = vi.fn();
    const response = await authenticatedApiClient({
      request,
      handler,
    });

    expect(response).toBe(handledResponse);
    expect(handleApiError).toHaveBeenCalledWith(
      request,
      {
        type: "internal_server_error",
        details: [
          {
            field: "error",
            issue: "An error occurred while processing your request. Please try again later.",
          },
        ],
      },
      undefined,
      thrownError
    );
  });
});
