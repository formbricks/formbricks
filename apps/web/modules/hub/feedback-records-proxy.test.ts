import { NextRequest } from "next/server";
import v8 from "node:v8";
import vm from "node:vm";
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

/**
 * Wraps a request the way Next's app-route runtime hands it to a route handler. For the default
 * `dynamic = "auto"`, `proxyNextRequest` (next/dist/server/route-modules/app-route/module.js) puts the
 * NextRequest behind a Proxy whose getter binds methods to the real target, and whose `clone()` returns
 * the cloned Request behind another Proxy. Reading through it works; handing it to a Request constructor
 * as `input` does not, because fetch objects keep their state in private fields a Proxy cannot carry
 * (nodejs/undici#4290). Building tests from a bare NextRequest is what let that ship unnoticed.
 */
const wrapLikeNextAppRoute = (request: NextRequest): NextRequest => {
  const handlers: ProxyHandler<Request> = {
    get(target, prop) {
      if (prop === "clone") return () => new Proxy(target.clone(), handlers);
      const value: unknown = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  };

  return new Proxy(request, handlers) as NextRequest;
};

const handlerRequestShapes: [string, (request: NextRequest) => NextRequest][] = [
  ["a plain NextRequest", (request) => request],
  ["the proxied request Next passes to route handlers", wrapLikeNextAppRoute],
];

/**
 * A real garbage collection, for the abort test. undici links a cloned Request's signal to its source
 * only through a WeakRef (nodejs/undici#4068), so whether a disconnect still reaches the Hub hop depends
 * on whether a collection ran in between — and nothing in a short test triggers one on its own.
 */
let collectGarbage: (() => void) | undefined;
const collectGarbageAcrossTurns = async (): Promise<void> => {
  // Enabled here rather than at import so only this test changes the worker's V8 flags.
  if (!collectGarbage) {
    v8.setFlagsFromString("--expose-gc");
    collectGarbage = vm.runInNewContext("gc") as () => void;
  }
  // A WeakRef target survives until the end of the job that last dereferenced it, so yield first.
  for (let pass = 0; pass < 3; pass++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    collectGarbage();
  }
};

/** The single Hub hop, as the URL and init the proxy handed to `fetch`, plus the Request they make. */
const hubCall = (fetchMock: ReturnType<typeof vi.fn>) => {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
  return { url, init, request: new Request(url, init) };
};

describe.each(handlerRequestShapes)("proxyFeedbackRecordsRequest with %s", (_shape, asHandlerRequest) => {
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

    await proxyFeedbackRecordsRequest(asHandlerRequest(new NextRequest(requestUrl)));

    const { url, init } = hubCall(fetchMock);
    expect(url.href).toBe(expectedHubUrl);
    expect(init.method).toBe("GET");
    // A bodyless request must not carry `duplex`, which undici only accepts alongside a body.
    expect(init.body).toBeUndefined();
    expect(init).not.toHaveProperty("duplex");
  });

  test("authorizes the incoming request and forwards exactly the body it authorized", async () => {
    // `tenant_id` decides authorization, so the Hub must receive the bytes the authorizer read and no
    // others — the clone has to be taken before authorization consumes the body.
    const body = JSON.stringify({ tenant_id: "dir_1", text: "Feedback" });
    let authorizedBody: string | undefined;
    mockAuthorizeGatewayRequest.mockImplementationOnce(async ({ request }: { request: NextRequest }) => {
      authorizedBody = await request.text();
      return new Response(null, { status: 200 });
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const request = asHandlerRequest(
      new NextRequest("http://localhost:3000/api/v3/feedbackRecords", {
        method: "POST",
        body,
        headers: {
          "content-type": "application/json",
          "x-request-id": "request_1",
        },
      })
    );

    await proxyFeedbackRecordsRequest(request);

    const authorizationInput = mockAuthorizeGatewayRequest.mock.calls[0][0];
    expect(authorizationInput.originalRequest).toEqual({
      method: "POST",
      url: new URL("http://localhost:3000/api/v3/feedbackRecords"),
    });
    expect(authorizationInput.requestId).toBe("request_1");
    expect(authorizedBody).toBe(body);

    const { init, request: hubRequest } = hubCall(fetchMock);
    expect(init).toHaveProperty("duplex", "half");
    expect(hubRequest.method).toBe("POST");
    expect(hubRequest.headers.get("content-type")).toBe("application/json");
    expect(await hubRequest.text()).toBe(authorizedBody);
  });

  test("gives the authorizer the request's cookies for session authentication", async () => {
    let sessionCookie: string | undefined;
    mockAuthorizeGatewayRequest.mockImplementationOnce(async ({ request }: { request: NextRequest }) => {
      sessionCookie = request.cookies.get("formbricks.session_token")?.value;
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [] })));

    await proxyFeedbackRecordsRequest(
      asHandlerRequest(
        new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1", {
          headers: { cookie: "formbricks.session_token=session_1" },
        })
      )
    );

    expect(sessionCookie).toBe("session_1");
  });

  test("aborts the Hub call when the client disconnects, even after a garbage collection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    // Stands in for the controller Next ties to the client connection (signalFromNodeResponse).
    const clientConnection = new AbortController();
    // A body, so the Hub hop is forwarded from a clone: the case whose own signal GC can sever.
    const request = asHandlerRequest(
      new NextRequest("http://localhost:3000/api/v3/feedbackRecords", {
        method: "POST",
        body: JSON.stringify({ tenant_id: "dir_1" }),
        signal: clientConnection.signal,
      })
    );

    await proxyFeedbackRecordsRequest(request);
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.signal?.aborted).toBe(false);

    await collectGarbageAcrossTurns();
    clientConnection.abort();

    expect(init.signal?.aborted).toBe(true);
    // Next keeps the incoming request alive for the whole handler; so does this test.
    expect(request.signal.aborted).toBe(true);
  });

  test("answers a client that hung up mid-call without logging a proxy failure", async () => {
    const fetchMock = vi.fn(
      (_url: URL, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const clientConnection = new AbortController();

    const pending = proxyFeedbackRecordsRequest(
      asHandlerRequest(
        new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1", {
          signal: clientConnection.signal,
        })
      )
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    clientConnection.abort();

    const response = await pending;
    expect(response.status).toBe(499);
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  test("never lets Next cache a Hub response, so reads stay live and writes always reach the Hub", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await proxyFeedbackRecordsRequest(
      asHandlerRequest(new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1"))
    );

    expect(hubCall(fetchMock).init.cache).toBe("no-store");
  });

  test("passes a Hub redirect to the caller instead of following it", async () => {
    const hubRedirect = new Response(null, {
      status: 307,
      headers: { location: "/v1/feedback-records/record_1" },
    });
    const fetchMock = vi.fn().mockResolvedValue(hubRedirect);
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyFeedbackRecordsRequest(
      asHandlerRequest(new NextRequest("http://localhost:3000/api/v3/feedbackRecords/record_1"))
    );

    expect(hubCall(fetchMock).init.redirect).toBe("manual");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/v1/feedback-records/record_1");
  });

  test("replaces client credentials with the internal Hub credential", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await proxyFeedbackRecordsRequest(
      asHandlerRequest(
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
      )
    );

    const { request: hubRequest } = hubCall(fetchMock);
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
      asHandlerRequest(new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1"))
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
      asHandlerRequest(new NextRequest("http://localhost:3000/v1/feedback-records?tenant_id=dir_1"))
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
      asHandlerRequest(
        new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1", {
          method: "PUT",
        })
      )
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Unsupported FeedbackRecords route");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects requests outside the FeedbackRecords route prefixes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyFeedbackRecordsRequest(
      asHandlerRequest(new NextRequest("http://localhost:3000/api/v3/feedbackRecordsFoo"))
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
      asHandlerRequest(
        new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1", {
          headers: {
            "x-request-id": "request_1",
          },
        })
      )
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
      asHandlerRequest(new NextRequest("http://localhost:3000/api/v3/feedbackRecords?tenant_id=dir_1"))
    );

    expect(response.status).toBe(404);
    expect(mockAuthorizeGatewayRequest).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
