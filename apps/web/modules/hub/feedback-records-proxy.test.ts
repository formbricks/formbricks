import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { proxyFeedbackRecordsRequest } from "@/modules/hub/feedback-records-proxy";

const { mockAuthorizeGatewayRequest, mockApplyRateLimit, mockLoggerError, mockLoggerWarn, runtime } =
  vi.hoisted(() => ({
    mockAuthorizeGatewayRequest: vi.fn(),
    mockApplyRateLimit: vi.fn(),
    mockLoggerError: vi.fn(),
    mockLoggerWarn: vi.fn(),
    runtime: {
      isProduction: false,
    },
  }));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockLoggerError,
    warn: mockLoggerWarn,
  },
}));

vi.mock("@/lib/constants", () => ({
  HUB_API_KEY: "hub-api-key",
  HUB_API_URL: "https://hub.test",
  get IS_PRODUCTION() {
    return runtime.isProduction;
  },
}));

vi.mock("@/modules/gateway-auth/lib/request", () => ({
  authorizeGatewayRequest: mockAuthorizeGatewayRequest,
  // Real implementations: the refusal shape and the choice of identifier are part of what these tests
  // are checking, not incidental collaborators.
  buildGatewayStatusResponse: (status: number, message: string) =>
    new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } }),
  getGatewayRateLimitIdentifier: (principal: { type: string; apiKeyId?: string; userId?: string }) =>
    principal.type === "apiKey" ? "api-key-1" : (principal.userId ?? "user-1"),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mockApplyRateLimit,
}));

vi.mock("@/modules/hub/feedback-records-gateway", () => ({
  feedbackRecordsGatewayAuthorizer: {
    authorize: vi.fn(),
    matches: vi.fn(),
  },
}));

/**
 * Like JSON.stringify, but renders Error values including the members that matter for a leak check.
 * `message`, `name` and `cause` are non-enumerable or exotic, so plain stringify drops them and any
 * "does not contain the URL" assertion built on it can never fail.
 *
 * Projects the same two links getHubErrorHint walks — `cause` and `AggregateError.errors` — because
 * Node buries the errno (and the URL alongside it) down either one. Omitting `errors` would leave the
 * multi-address case silently unchecked, which is the failure this assertion exists to avoid.
 *
 * Tracks visited errors because the replacer hands back a fresh object each time, which defeats
 * stringify's own cycle detection — a self-referencing `cause` (another shape getHubErrorHint
 * explicitly handles) would otherwise recurse until the stack blows instead of failing the assertion.
 */
const serializeIncludingErrors = (value: unknown): string => {
  const seen = new WeakSet<Error>();

  return JSON.stringify(value, (_key, val) => {
    if (!(val instanceof Error)) return val;
    if (seen.has(val)) return "[circular]";
    seen.add(val);

    return {
      name: val.name,
      message: val.message,
      stack: val.stack,
      cause: val.cause,
      errors: (val as { errors?: unknown }).errors,
    };
  });
};

describe("proxyFeedbackRecordsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.isProduction = false;
    mockAuthorizeGatewayRequest.mockResolvedValue({
      status: "allow",
      principal: { type: "apiKey", authentication: { apiKeyId: "api-key-1" } },
    });
    mockApplyRateLimit.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test.each([
    [
      "http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1&limit=25",
      "https://hub.test/v1/feedback-records?tenant_id=dir_1&limit=25",
    ],
    [
      "http://localhost:3000/api/v3/feedbackRecords/record_1/similar?limit=3",
      "https://hub.test/v1/feedback-records/record_1/similar?limit=3",
    ],
    [
      "http://localhost:3000/v1/feedback-records?tenant_id=dir_1&limit=25",
      "https://hub.test/v1/feedback-records?tenant_id=dir_1&limit=25",
    ],
    [
      "http://localhost:3000/v1/feedback-records/record_1?include=fields",
      "https://hub.test/v1/feedback-records/record_1?include=fields",
    ],
  ])("proxies %s to %s", async (requestUrl, expectedHubUrl) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await proxyFeedbackRecordsRequest(new NextRequest(requestUrl));

    const hubRequest = fetchMock.mock.calls[0][0] as Request;
    expect(hubRequest.url).toBe(expectedHubUrl);
    expect(fetchMock).toHaveBeenCalledWith(hubRequest, { cache: "no-store" });
  });

  test("authorizes a cloned request before forwarding the original body", async () => {
    const body = JSON.stringify({ tenant_id: "dir_1", text: "Feedback" });
    mockAuthorizeGatewayRequest.mockImplementationOnce(async ({ request }: { request: NextRequest }) => {
      expect(await request.text()).toBe(body);
      return { status: "allow", principal: { type: "apiKey", authentication: { apiKeyId: "api-key-1" } } };
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/api/v3/feedbackRecords", {
        method: "POST",
        body,
        headers: {
          "content-type": "application/json",
          "x-request-id": "request_1",
        },
      })
    );

    const authorizationInput = mockAuthorizeGatewayRequest.mock.calls[0][0];
    expect(authorizationInput.originalRequest).toEqual({
      method: "POST",
      url: new URL("http://localhost:3000/api/v3/feedbackRecords"),
    });
    expect(authorizationInput.requestId).toBe("request_1");

    const hubRequest = fetchMock.mock.calls[0][0] as Request;
    expect(hubRequest.method).toBe("POST");
    expect(hubRequest.headers.get("content-type")).toBe("application/json");
    expect(await hubRequest.text()).toBe(body);
  });

  test("replaces client credentials with the internal Hub credential", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/v1/feedback-records?tenant_id=dir_1", {
        headers: {
          authorization: "Bearer client-token",
          connection: "keep-alive, X-Client-Context",
          cookie: "session=secret",
          host: "localhost:3000",
          "x-api-key": "fbk_client-key",
          "x-client-context": "sensitive-client-context",
        },
      })
    );

    const hubRequest = fetchMock.mock.calls[0][0] as Request;
    expect(hubRequest.headers.get("authorization")).toBe("Bearer hub-api-key");
    expect(hubRequest.headers.has("cookie")).toBe(false);
    expect(hubRequest.headers.has("x-api-key")).toBe(false);
    expect(hubRequest.headers.has("connection")).toBe(false);
    expect(hubRequest.headers.has("host")).toBe(false);
    expect(hubRequest.headers.has("x-client-context")).toBe(false);
  });

  test("passes the Hub response through unchanged", async () => {
    const hubResponse = new Response("created", {
      status: 201,
      headers: {
        "content-type": "application/json",
        "x-hub-request-id": "hub_request_1",
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(hubResponse));

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1")
    );

    expect(response).toBe(hubResponse);
    expect(response.status).toBe(201);
    expect(response.headers.get("x-hub-request-id")).toBe("hub_request_1");
    expect(await response.text()).toBe("created");
  });

  test("returns the authorization response without calling Hub", async () => {
    const authorizationResponse = new Response("Forbidden", { status: 403 });
    mockAuthorizeGatewayRequest.mockResolvedValueOnce({ status: "deny", response: authorizationResponse });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/v1/feedback-records?tenant_id=dir_1")
    );

    expect(response).toBe(authorizationResponse);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * The same config every v3 route gets from the shared wrapper, counted against the same identifier.
   * This path cannot use the wrapper — it forwards a request rather than handling one — so what is
   * pinned here is that it borrows the shared config rather than inventing a limit of its own.
   */
  test("applies the shared v3 rate limit, keyed on the authorized principal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/v1/feedback-records?tenant_id=dir_1")
    );

    expect(mockApplyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "api:v3", allowedPerInterval: 100, interval: 60 }),
      "api-key-1"
    );
  });

  test("refuses with 429 and Retry-After when the limit is exceeded", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockApplyRateLimit.mockRejectedValueOnce(new TooManyRequestsError("Rate limit exceeded", 30));

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/v1/feedback-records?tenant_id=dir_1")
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    // Same media type as the 401 and 403 on this path, not the v3 routes' problem+json.
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not forward to the store when the limit is exceeded", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockApplyRateLimit.mockRejectedValueOnce(new TooManyRequestsError("Rate limit exceeded"));

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/v1/feedback-records?tenant_id=dir_1")
    );

    expect(response.status).toBe(429);
    // No retryAfter on the error, so no header rather than a header with "undefined" in it.
    expect(response.headers.get("Retry-After")).toBeNull();
  });

  test("returns the authorizer response for an unsupported operation", async () => {
    mockAuthorizeGatewayRequest.mockResolvedValueOnce({
      status: "deny",
      response: new Response("Unsupported FeedbackRecords route", { status: 400 }),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1", {
        method: "PUT",
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Unsupported FeedbackRecords route");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects requests outside the FeedbackRecords route prefixes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/api/v3/feedbackRecordsFoo")
    );

    expect(response.status).toBe(400);
    expect(mockAuthorizeGatewayRequest).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns a sanitized bad gateway response when Hub is unavailable", async () => {
    // Carries `code` like a real Node connection failure, and keeps the URL in the message so the
    // sanitization assertion below is still exercising something.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("connect ECONNREFUSED secret-url"), { code: "ECONNREFUSED" })
        )
    );

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1", {
        headers: {
          "x-request-id": "request_1",
        },
      })
    );

    expect(response.status).toBe(502);
    expect(await response.text()).toBe("Bad Gateway");
    expect(mockLoggerError).toHaveBeenCalledWith(
      {
        requestId: "request_1",
        method: "GET",
        pathname: "/api/v3/feedbackRecords",
        hint: expect.stringContaining("Hub looks unreachable"),
      },
      "Feedback records local proxy request failed"
    );

    // The whole point of building this payload by hand: a fetch failure carries the target URL in
    // its message, so neither the log nor the response body may echo the error itself.
    //
    // Serialized with an Error-aware replacer, not plain JSON.stringify. `Error.prototype.message`
    // is non-enumerable, so stringify renders a logged error as `{"code":"ECONNREFUSED"}` and the
    // URL never appears — the assertion would pass even with `err` back in the payload, which is
    // the regression it exists to catch.
    expect(serializeIncludingErrors(mockLoggerError.mock.calls)).not.toContain("secret-url");
  });

  /**
   * The inverse of what this asserted before ENG-3117. The proxy refused in production while the
   * gateway served these paths there; now it is the only thing serving `/v1/feedback-records`, so
   * refusing would take the compatibility path down in the one environment that has callers.
   */
  test("serves production, now that no gateway routes these paths", async () => {
    runtime.isProduction = true;
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/v1/feedback-records?tenant_id=dir_1")
    );

    expect(response.status).toBe(200);
    expect(mockAuthorizeGatewayRequest).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
  });

  test("still authorizes before forwarding in production", async () => {
    runtime.isProduction = true;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockAuthorizeGatewayRequest.mockResolvedValueOnce({
      status: "deny",
      response: new Response("Forbidden", { status: 403 }),
    });

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/v1/feedback-records?tenant_id=dir_1")
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
