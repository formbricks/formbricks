import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { authenticateGatewayRequest, authorizeGatewayRequest } from "./request";

const {
  mockApplyRateLimit,
  mockAuthenticateApiKeyFromHeaders,
  mockGetApiKeyFromHeaders,
  mockGetProxySession,
  mockUserFindUnique,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockAuthenticateApiKeyFromHeaders: vi.fn(),
  mockGetApiKeyFromHeaders: vi.fn(),
  mockGetProxySession: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockApplyRateLimit: vi.fn(),
}));

vi.mock("@/modules/api/lib/api-key-auth", () => ({
  authenticateApiKeyFromHeaders: mockAuthenticateApiKeyFromHeaders,
  getApiKeyFromHeaders: mockGetApiKeyFromHeaders,
}));

vi.mock("@/modules/auth/lib/proxy-session", () => ({
  getProxySession: mockGetProxySession,
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mockApplyRateLimit,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}));

describe("authenticateGatewayRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetApiKeyFromHeaders.mockReturnValue(null);
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue(null);
    mockGetProxySession.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ id: "user_1", isActive: true });
  });

  test("logs and returns invalid when an explicit API key cannot be authenticated", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_invalid");

    const result = await authenticateGatewayRequest(new NextRequest("http://localhost/test"));

    expect(result).toEqual({ status: "invalid" });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      { hasApiKey: true, reason: "invalid_api_key" },
      "Gateway authentication failed"
    );
  });

  test("logs and returns invalid when gateway token verification fails", async () => {
    const verifyError = new Error("invalid token");

    const result = await authenticateGatewayRequest(new NextRequest("http://localhost/test"), {
      getTokenFromHeaders: () => "header.payload.signature",
      verifyToken: () => {
        throw verifyError;
      },
    });

    expect(result).toEqual({ status: "invalid" });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      { error: verifyError, hasToken: true, reason: "token_verification_failed" },
      "Gateway authentication failed"
    );
  });

  test("logs and returns invalid when the gateway token user is inactive", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user_1", isActive: false });

    const result = await authenticateGatewayRequest(new NextRequest("http://localhost/test"), {
      getTokenFromHeaders: () => "header.payload.signature",
      verifyToken: () => ({ userId: "user_1" }),
    });

    expect(result).toEqual({ status: "invalid" });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      {
        hasToken: true,
        reason: "user_missing_or_inactive",
        userId: "user_1",
        userFound: true,
        isActive: false,
      },
      "Gateway authentication failed"
    );
  });

  test("propagates user lookup errors instead of converting them into invalid auth", async () => {
    const lookupError = new Error("database unavailable");
    mockUserFindUnique.mockRejectedValue(lookupError);

    await expect(
      authenticateGatewayRequest(new NextRequest("http://localhost/test"), {
        getTokenFromHeaders: () => "header.payload.signature",
        verifyToken: () => ({ userId: "user_1" }),
      })
    ).rejects.toThrow("database unavailable");
  });
});

/**
 * The limit lives here rather than in each caller, and it runs between authentication and
 * authorization. `authorize` resolves the tenant, checks entitlements and checks permissions, each a
 * query — so limiting only requests that pass all of them lets any valid credential spend those
 * queries without bound by failing the last check every time. The two forward-auth callers had no
 * limit at all before this.
 */
describe("authorizeGatewayRequest — the principal rate limit", () => {
  const authorizerWith = (authorize: ReturnType<typeof vi.fn>) => ({
    matches: () => true,
    // No gateway token: this suite is about the API-key principal, and the token branch has its own
    // coverage in `authenticateGatewayRequest` above.
    gatewayToken: undefined,
    authorize,
  });

  const run = (authorize: ReturnType<typeof vi.fn>) =>
    authorizeGatewayRequest({
      request: new NextRequest("http://localhost:3000/v1/feedback-records?tenant_id=dir_1"),
      originalRequest: { method: "GET", url: new URL("http://localhost:3000/v1/feedback-records") },
      authorizers: [authorizerWith(authorize) as never],
      requestId: "req-1",
      unsupportedRouteMessage: "Unsupported",
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_key");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({ apiKeyId: "api-key-1" });
    mockApplyRateLimit.mockResolvedValue(undefined);
  });

  test("is counted against the authenticated principal", async () => {
    await run(vi.fn().mockResolvedValue({ status: "allow" }));

    expect(mockApplyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "api:v3", allowedPerInterval: 100, interval: 60 }),
      "api-key-1"
    );
  });

  /** The property the finding is about: the expensive checks must not run for a limited caller. */
  test("refuses before authorization runs at all", async () => {
    mockApplyRateLimit.mockRejectedValueOnce(new TooManyRequestsError("Rate limit exceeded", 30));
    const authorize = vi.fn();

    const outcome = await run(authorize);

    expect(authorize).not.toHaveBeenCalled();
    expect(outcome.status).toBe("deny");
    expect(outcome.status === "deny" && outcome.response.status).toBe(429);
    expect(outcome.status === "deny" && outcome.response.headers.get("Retry-After")).toBe("30");
    // Same media type as the 401 and 403 on this path, not the v3 routes' problem+json.
    expect(outcome.status === "deny" && outcome.response.headers.get("content-type")).toContain("text/plain");
  });

  test("omits Retry-After when the limiter did not supply one", async () => {
    mockApplyRateLimit.mockRejectedValueOnce(new TooManyRequestsError("Rate limit exceeded"));

    const outcome = await run(vi.fn());

    expect(outcome.status === "deny" && outcome.response.headers.get("Retry-After")).toBeNull();
  });

  /** A real fault must not be reported as "too many requests", which would hide it. */
  test("lets a non-limit failure propagate rather than answering 429", async () => {
    mockApplyRateLimit.mockRejectedValueOnce(new Error("redis is down"));

    await expect(run(vi.fn())).rejects.toThrow("redis is down");
  });

  test("an unauthenticated caller is refused without consuming the limit", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue(undefined);
    mockGetProxySession.mockResolvedValue(null);

    const outcome = await run(vi.fn());

    expect(outcome.status === "deny" && outcome.response.status).toBe(401);
    expect(mockApplyRateLimit).not.toHaveBeenCalled();
  });
});
