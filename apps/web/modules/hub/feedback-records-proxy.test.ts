import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { proxyFeedbackRecordsRequest } from "@/modules/hub/feedback-records-proxy";

const { mockAuthorizeGatewayRequest, mockLoggerError, runtime } = vi.hoisted(() => ({
  mockAuthorizeGatewayRequest: vi.fn(),
  mockLoggerError: vi.fn(),
  runtime: {
    isProduction: false,
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockLoggerError,
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
    mockAuthorizeGatewayRequest.mockResolvedValue(new Response(null, { status: 200 }));
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
      return new Response(null, { status: 200 });
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
    mockAuthorizeGatewayRequest.mockResolvedValueOnce(authorizationResponse);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/v1/feedback-records?tenant_id=dir_1")
    );

    expect(response).toBe(authorizationResponse);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns the authorizer response for an unsupported operation", async () => {
    mockAuthorizeGatewayRequest.mockResolvedValueOnce(
      new Response("Unsupported FeedbackRecords route", { status: 400 })
    );
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

  test("is unavailable in production", async () => {
    runtime.isProduction = true;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyFeedbackRecordsRequest(
      new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1")
    );

    expect(response.status).toBe(404);
    expect(mockAuthorizeGatewayRequest).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
