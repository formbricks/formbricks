import * as Sentry from "@sentry/nextjs";
import { NextRequest } from "next/server";
import { Mock, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { AuthenticationMethod } from "@/app/middleware/endpoint-validator";
import { responses } from "./response";

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  __esModule: true,
  queueAuditEvent: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn(),
}));

const mockContextualLoggerError = vi.fn();
const mockContextualLoggerWarn = vi.fn();
const mockContextualLoggerInfo = vi.fn();
const V1_MANAGEMENT_SURVEYS_URL = "https://api.test/api/v1/management/surveys";

vi.mock("@formbricks/logger", () => {
  const mockWithContextInstance = vi.fn(() => ({
    error: mockContextualLoggerError,
    warn: mockContextualLoggerWarn,
    info: mockContextualLoggerInfo,
  }));
  return {
    logger: {
      withContext: mockWithContextInstance,
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock("@/app/api/v1/auth", () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/app/middleware/endpoint-validator", async () => {
  const original = await vi.importActual("@/app/middleware/endpoint-validator");
  return {
    ...original,
    isClientSideApiRoute: vi.fn().mockReturnValue({ isClientSideApi: false, isRateLimited: true }),
    isManagementApiRoute: vi.fn().mockReturnValue({ isManagementApi: false, authenticationMethod: "apiKey" }),
    isIntegrationRoute: vi.fn().mockReturnValue(false),
  };
});

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyClientRateLimit: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    api: {
      client: { windowMs: 60000, max: 100 },
      clientEnvironment: { windowMs: 60000, max: 1000 },
      v1: { windowMs: 60000, max: 1000 },
    },
  },
}));

function createMockRequest({ method = "GET", url = "https://api.test/endpoint", headers = new Map() } = {}) {
  const parsedUrl = url.startsWith("/") ? new URL(url, "http://localhost:3000") : new URL(url);

  return {
    method,
    url,
    headers: {
      get: (key: string) => headers.get(key),
    },
    nextUrl: {
      pathname: parsedUrl.pathname,
    },
  } as unknown as NextRequest;
}

const mockApiAuthentication = {
  type: "apiKey" as const,
  environmentPermissions: [],
  apiKeyId: "api-key-1",
  organizationId: "org-1",
  organizationAccess: "all" as const,
} as unknown as TAuthenticationApiKey;

describe("withV1ApiWrapper", () => {
  beforeEach(() => {
    vi.resetModules();

    vi.doMock("@/lib/constants", () => ({
      AUDIT_LOG_ENABLED: true,
      IS_PRODUCTION: true,
      SENTRY_DSN: "dsn",
      ENCRYPTION_KEY: "test-key",
      REDIS_URL: "redis://localhost:6379",
    }));

    vi.clearAllMocks();
  });

  test("logs and audits on error response with API key authentication", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } =
      (await import("@/modules/ee/audit-logs/lib/handler")) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");

    vi.mocked(authenticateRequest).mockResolvedValue(mockApiAuthentication);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);

    const handler = vi.fn().mockImplementation(async ({ auditLog }) => {
      if (auditLog) {
        auditLog.targetId = "target-1";
      }
      return {
        response: responses.internalServerErrorResponse("fail"),
      };
    });

    const req = createMockRequest({
      url: V1_MANAGEMENT_SURVEYS_URL,
      headers: new Map([["x-request-id", "abc-123"]]),
    });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler, action: "created", targetType: "survey" });
    await wrapped(req, undefined);

    expect(logger.withContext).toHaveBeenCalled();
    expect(mockContextualLoggerError).toHaveBeenCalled();
    expect(mockedQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "abc-123",
        userType: "api",
        apiUrl: req.url,
        action: "created",
        status: "failure",
        targetType: "survey",
        userId: "api-key-1",
        targetId: "target-1",
        organizationId: "org-1",
      })
    );
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          apiVersion: "v1",
          correlationId: "abc-123",
          method: "GET",
          path: "/api/v1/management/surveys",
        }),
        extra: expect.objectContaining({
          error: expect.objectContaining({
            message: "API V1 error, id: abc-123",
          }),
          originalError: undefined,
        }),
        contexts: expect.objectContaining({
          apiRequest: expect.objectContaining({
            apiVersion: "v1",
            correlationId: "abc-123",
            method: "GET",
            path: "/api/v1/management/surveys",
            status: 500,
          }),
        }),
      })
    );
  });

  test("does not log Sentry if not 500", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } =
      (await import("@/modules/ee/audit-logs/lib/handler")) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");

    vi.mocked(authenticateRequest).mockResolvedValue(mockApiAuthentication);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);

    const handler = vi.fn().mockImplementation(async ({ auditLog }) => {
      if (auditLog) {
        auditLog.targetId = "target-1";
      }
      return {
        response: responses.badRequestResponse("bad req"),
      };
    });

    const req = createMockRequest({ url: V1_MANAGEMENT_SURVEYS_URL });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler, action: "created", targetType: "survey" });
    await wrapped(req, undefined);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(logger.withContext).toHaveBeenCalled();
    expect(mockContextualLoggerError).toHaveBeenCalled();
    expect(mockedQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userType: "api",
        apiUrl: req.url,
        action: "created",
        status: "failure",
        targetType: "survey",
        userId: "api-key-1",
        targetId: "target-1",
        organizationId: "org-1",
      })
    );
  });

  test("logs and audits on thrown error", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } =
      (await import("@/modules/ee/audit-logs/lib/handler")) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");

    vi.mocked(authenticateRequest).mockResolvedValue(mockApiAuthentication);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);

    const handler = vi.fn().mockImplementation(async ({ auditLog }) => {
      if (auditLog) {
        auditLog.targetId = "target-1";
      }
      throw new Error("fail!");
    });

    const req = createMockRequest({
      url: V1_MANAGEMENT_SURVEYS_URL,
      headers: new Map([["x-request-id", "err-1"]]),
    });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler, action: "created", targetType: "survey" });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      code: "internal_server_error",
      message: "An unexpected error occurred.",
      details: {},
    });
    expect(logger.withContext).toHaveBeenCalled();
    expect(mockContextualLoggerError).toHaveBeenCalled();
    expect(mockedQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "err-1",
        userType: "api",
        apiUrl: req.url,
        action: "created",
        status: "failure",
        targetType: "survey",
        userId: "api-key-1",
        targetId: "target-1",
        organizationId: "org-1",
      })
    );
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "fail!",
      }),
      expect.objectContaining({
        tags: expect.objectContaining({
          apiVersion: "v1",
          correlationId: "err-1",
          method: "GET",
          path: "/api/v1/management/surveys",
        }),
        extra: expect.objectContaining({
          error: expect.objectContaining({
            message: "fail!",
          }),
          originalError: expect.objectContaining({
            message: "fail!",
          }),
        }),
      })
    );
  });

  test("uses handler result error for handled 500 responses", async () => {
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");

    vi.mocked(authenticateRequest).mockResolvedValue(mockApiAuthentication);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);

    const handledError = new Error("handled failure");
    const handler = vi.fn().mockResolvedValue({
      response: responses.internalServerErrorResponse("fail"),
      error: handledError,
    });

    const req = createMockRequest({
      url: "https://api.test/api/v2/client/environment",
      headers: new Map([["x-request-id", "handled-1"]]),
    });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(500);
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      handledError,
      expect.objectContaining({
        tags: expect.objectContaining({
          apiVersion: "v2",
          correlationId: "handled-1",
          method: "GET",
          path: "/api/v2/client/environment",
        }),
        extra: expect.objectContaining({
          error: expect.objectContaining({
            message: "handled failure",
          }),
          originalError: expect.objectContaining({
            message: "handled failure",
          }),
        }),
      })
    );
  });

  test("does not log on success response but still audits", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } =
      (await import("@/modules/ee/audit-logs/lib/handler")) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");

    vi.mocked(authenticateRequest).mockResolvedValue(mockApiAuthentication);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);

    const handler = vi.fn().mockImplementation(async ({ auditLog }) => {
      if (auditLog) {
        auditLog.targetId = "target-1";
      }
      return {
        response: responses.successResponse({ ok: true }),
      };
    });

    const req = createMockRequest({ url: V1_MANAGEMENT_SURVEYS_URL });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler, action: "created", targetType: "survey" });
    await wrapped(req, undefined);

    expect(logger.withContext).not.toHaveBeenCalled();
    expect(mockContextualLoggerError).not.toHaveBeenCalled();
    expect(mockedQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userType: "api",
        apiUrl: req.url,
        action: "created",
        status: "success",
        targetType: "survey",
        userId: "api-key-1",
        targetId: "target-1",
        organizationId: "org-1",
      })
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("does not call audit if AUDIT_LOG_ENABLED is false", async () => {
    vi.doMock("@/lib/constants", () => ({
      AUDIT_LOG_ENABLED: false,
      IS_PRODUCTION: true,
      SENTRY_DSN: "dsn",
      ENCRYPTION_KEY: "test-key",
      REDIS_URL: "redis://localhost:6379",
    }));

    const { queueAuditEvent: mockedQueueAuditEvent } =
      (await import("@/modules/ee/audit-logs/lib/handler")) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");
    const { withV1ApiWrapper } = await import("./with-api-logging");

    vi.mocked(authenticateRequest).mockResolvedValue(mockApiAuthentication);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);

    const handler = vi.fn().mockResolvedValue({
      response: responses.internalServerErrorResponse("fail"),
    });

    const req = createMockRequest({ url: V1_MANAGEMENT_SURVEYS_URL });
    const wrapped = withV1ApiWrapper({ handler, action: "created", targetType: "survey" });
    await wrapped(req, undefined);

    expect(mockedQueueAuditEvent).not.toHaveBeenCalled();
  });

  test("handles client-side API routes without authentication", async () => {
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { applyClientRateLimit } = await import("@/modules/core/rate-limit/helpers");

    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: true, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: false,
      authenticationMethod: AuthenticationMethod.None,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);
    vi.mocked(authenticateRequest).mockResolvedValue(null);
    vi.mocked(applyClientRateLimit).mockResolvedValue({ allowed: true });

    const handler = vi.fn().mockResolvedValue({
      response: responses.successResponse({ data: "test" }),
    });

    const req = createMockRequest({ url: "/api/v1/client/ck12345678901234567890123/displays" });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(200);
    expect(applyClientRateLimit).toHaveBeenCalledWith("ck12345678901234567890123", undefined);
    expect(handler).toHaveBeenCalledWith({
      req,
      props: undefined,
      auditLog: undefined,
      authentication: null,
    });
  });

  test("passes custom client rate limit config with the environment ID", async () => {
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { applyClientRateLimit } = await import("@/modules/core/rate-limit/helpers");

    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: true, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: false,
      authenticationMethod: AuthenticationMethod.None,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);
    vi.mocked(authenticateRequest).mockResolvedValue(null);
    vi.mocked(applyClientRateLimit).mockResolvedValue({ allowed: true });

    const customRateLimitConfig = {
      interval: 60,
      allowedPerInterval: 5,
      namespace: "storage:upload",
    };
    const handler = vi.fn().mockResolvedValue({
      response: responses.successResponse({ data: "test" }),
    });

    const req = createMockRequest({ url: "/api/v1/client/ck12345678901234567890123/storage" });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler, customRateLimitConfig });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(200);
    expect(applyClientRateLimit).toHaveBeenCalledWith("ck12345678901234567890123", customRateLimitConfig);
    expect(handler).toHaveBeenCalled();
  });

  test("rejects invalid client environment IDs before rate limiting", async () => {
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { applyClientRateLimit } = await import("@/modules/core/rate-limit/helpers");

    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: true, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: false,
      authenticationMethod: AuthenticationMethod.None,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);
    vi.mocked(authenticateRequest).mockResolvedValue(null);
    vi.mocked(applyClientRateLimit).mockResolvedValue({ allowed: true });

    const handler = vi.fn().mockResolvedValue({
      response: responses.successResponse({ data: "test" }),
    });

    const req = createMockRequest({ url: "/api/v1/client/not-a-cuid/displays" });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "bad_request",
      message: "Invalid environment ID format",
      details: {},
    });
    expect(applyClientRateLimit).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      {
        pathname: "/api/v1/client/not-a-cuid/displays",
        environmentId: "not-a-cuid",
      },
      "Invalid client API environment ID for rate limiting"
    );
  });

  test("returns authentication error for non-client routes without auth", async () => {
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");
    const { authenticateRequest } = await import("@/app/api/v1/auth");

    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);
    vi.mocked(authenticateRequest).mockResolvedValue(null);

    const handler = vi.fn();
    const req = createMockRequest({ url: V1_MANAGEMENT_SURVEYS_URL });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  test("uses unauthenticatedResponse when provided instead of default 401", async () => {
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");
    const { getServerSession } = await import("next-auth");

    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.Session,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);
    vi.mocked(getServerSession).mockResolvedValue(null);

    const custom401 = new Response(JSON.stringify({ title: "Custom", status: 401 }), {
      status: 401,
      headers: { "Content-Type": "application/problem+json" },
    });

    const handler = vi.fn();
    const req = createMockRequest({ url: "https://api.test/api/v3/surveys" });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({
      handler,
      unauthenticatedResponse: () => custom401,
    });
    const res = await wrapped(req, undefined);

    expect(res).toBe(custom401);
    expect(handler).not.toHaveBeenCalled();
    expect(mockContextualLoggerError).toHaveBeenCalled();
  });

  test("handles rate limiting errors", async () => {
    const { applyRateLimit } = await import("@/modules/core/rate-limit/helpers");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");
    const { authenticateRequest } = await import("@/app/api/v1/auth");

    vi.mocked(authenticateRequest).mockResolvedValue(mockApiAuthentication);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);
    vi.mocked(applyRateLimit).mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached. Please try again later.")
    );

    const handler = vi.fn();
    const req = createMockRequest({ url: V1_MANAGEMENT_SURVEYS_URL });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });

  test("returns a generic error for unexpected client rate limit failures", async () => {
    const { applyClientRateLimit } = await import("@/modules/core/rate-limit/helpers");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");
    const { authenticateRequest } = await import("@/app/api/v1/auth");

    vi.mocked(authenticateRequest).mockResolvedValue(null);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: true, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: false,
      authenticationMethod: AuthenticationMethod.None,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);

    const underlyingError = new Error("Failed to hash IP");
    vi.mocked(applyClientRateLimit).mockRejectedValue(underlyingError);

    const handler = vi.fn();
    const req = createMockRequest({
      url: "/api/v1/client/ck12345678901234567890123/displays",
      headers: new Map([["x-request-id", "rate-limit-failure"]]),
    });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      code: "internal_server_error",
      message: "Something went wrong. Please try again.",
      details: {},
    });
    expect(handler).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      underlyingError,
      expect.objectContaining({
        tags: expect.objectContaining({
          correlationId: "rate-limit-failure",
          path: "/api/v1/client/ck12345678901234567890123/displays",
        }),
        contexts: expect.objectContaining({
          apiRequest: expect.objectContaining({
            status: 500,
          }),
        }),
      })
    );
  });

  test("skips audit log creation when no action/targetType provided", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } =
      (await import("@/modules/ee/audit-logs/lib/handler")) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");

    vi.mocked(authenticateRequest).mockResolvedValue(mockApiAuthentication);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);

    const handler = vi.fn().mockResolvedValue({
      response: responses.successResponse({ data: "test" }),
    });

    const req = createMockRequest({ url: V1_MANAGEMENT_SURVEYS_URL });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    await wrapped(req, undefined);

    expect(handler).toHaveBeenCalledWith({
      req,
      props: undefined,
      auditLog: undefined,
      authentication: mockApiAuthentication,
    });
    expect(mockedQueueAuditEvent).not.toHaveBeenCalled();
  });

  test("does not allow organization-only API keys by default", async () => {
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");

    vi.mocked(authenticateRequest).mockResolvedValue(null);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);

    const handler = vi.fn();
    const req = createMockRequest({ url: "https://api.test/api/v1/management/action-classes" });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const response = await wrapped(req, undefined);

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(authenticateRequest).toHaveBeenCalledWith(req, { allowOrganizationOnlyApiKey: false });
  });

  test("allows organization-only API keys when the route opts in", async () => {
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } =
      await import("@/app/middleware/endpoint-validator");

    vi.mocked(authenticateRequest).mockResolvedValue(mockApiAuthentication);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);

    const handler = vi.fn().mockResolvedValue({
      response: responses.successResponse({ data: "test" }),
    });
    const req = createMockRequest({ url: V1_MANAGEMENT_SURVEYS_URL });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler, allowOrganizationOnlyApiKey: true });
    const response = await wrapped(req, undefined);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    expect(authenticateRequest).toHaveBeenCalledWith(req, { allowOrganizationOnlyApiKey: true });
  });
});

describe("buildAuditLogBaseObject", () => {
  test("creates audit log base object with correct structure", async () => {
    const { buildAuditLogBaseObject } = await import("./with-api-logging");

    const result = buildAuditLogBaseObject("created", "survey", V1_MANAGEMENT_SURVEYS_URL);

    expect(result).toEqual({
      action: "created",
      targetType: "survey",
      userId: "unknown",
      targetId: "unknown",
      organizationId: "unknown",
      status: "failure",
      oldObject: undefined,
      newObject: undefined,
      userType: "api",
      apiUrl: V1_MANAGEMENT_SURVEYS_URL,
    });
  });
});
