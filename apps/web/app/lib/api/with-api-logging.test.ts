import { AuthenticationMethod } from "@/app/middleware/endpoint-validator";
import * as Sentry from "@sentry/nextjs";
import { NextRequest } from "next/server";
import { Mock, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { responses } from "./response";

// Mocks
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  __esModule: true,
  queueAuditEvent: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Define these outside the mock factory so they can be referenced in tests and reset by clearAllMocks.
const mockContextualLoggerError = vi.fn();
const mockContextualLoggerWarn = vi.fn();
const mockContextualLoggerInfo = vi.fn();

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
    isSyncWithUserIdentificationEndpoint: vi.fn().mockReturnValue(null),
  };
});

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    api: {
      client: { windowMs: 60000, max: 100 },
      v1: { windowMs: 60000, max: 1000 },
      syncUserIdentification: { windowMs: 60000, max: 50 },
    },
  },
}));

function createMockRequest({ method = "GET", url = "https://api.test/endpoint", headers = new Map() } = {}) {
  // Parse the URL to get the pathname
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
  hashedApiKey: "test-api-key",
  apiKeyId: "api-key-1",
  organizationId: "org-1",
} as TAuthenticationApiKey;

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
    const { queueAuditEvent: mockedQueueAuditEvent } = (await import(
      "@/modules/ee/audit-logs/lib/handler"
    )) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } = await import(
      "@/app/middleware/endpoint-validator"
    );

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
      url: "https://api.test/v1/management/surveys",
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
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: expect.objectContaining({ correlationId: "abc-123" }) })
    );
  });

  test("does not log Sentry if not 500", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } = (await import(
      "@/modules/ee/audit-logs/lib/handler"
    )) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } = await import(
      "@/app/middleware/endpoint-validator"
    );

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

    const req = createMockRequest({ url: "https://api.test/v1/management/surveys" });
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
    const { queueAuditEvent: mockedQueueAuditEvent } = (await import(
      "@/modules/ee/audit-logs/lib/handler"
    )) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } = await import(
      "@/app/middleware/endpoint-validator"
    );

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
      url: "https://api.test/v1/management/surveys",
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
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: expect.objectContaining({ correlationId: "err-1" }) })
    );
  });

  test("does not log on success response but still audits", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } = (await import(
      "@/modules/ee/audit-logs/lib/handler"
    )) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } = await import(
      "@/app/middleware/endpoint-validator"
    );

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

    const req = createMockRequest({ url: "https://api.test/v1/management/surveys" });
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

    const { queueAuditEvent: mockedQueueAuditEvent } = (await import(
      "@/modules/ee/audit-logs/lib/handler"
    )) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } = await import(
      "@/app/middleware/endpoint-validator"
    );
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

    const req = createMockRequest({ url: "https://api.test/v1/management/surveys" });
    const wrapped = withV1ApiWrapper({ handler, action: "created", targetType: "survey" });
    await wrapped(req, undefined);

    expect(mockedQueueAuditEvent).not.toHaveBeenCalled();
  });

  test("handles client-side API routes without authentication", async () => {
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } = await import(
      "@/app/middleware/endpoint-validator"
    );
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { applyIPRateLimit } = await import("@/modules/core/rate-limit/helpers");

    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: true, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: false,
      authenticationMethod: AuthenticationMethod.None,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);
    vi.mocked(authenticateRequest).mockResolvedValue(null);
    vi.mocked(applyIPRateLimit).mockResolvedValue(undefined);

    const handler = vi.fn().mockResolvedValue({
      response: responses.successResponse({ data: "test" }),
    });

    const req = createMockRequest({ url: "/api/v1/client/displays" });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith({
      req,
      props: undefined,
      auditLog: undefined,
      authentication: null,
    });
  });

  test("returns authentication error for non-client routes without auth", async () => {
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } = await import(
      "@/app/middleware/endpoint-validator"
    );
    const { authenticateRequest } = await import("@/app/api/v1/auth");

    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);
    vi.mocked(authenticateRequest).mockResolvedValue(null);

    const handler = vi.fn();
    const req = createMockRequest({ url: "https://api.test/v1/management/surveys" });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  test("handles rate limiting errors", async () => {
    const { applyRateLimit } = await import("@/modules/core/rate-limit/helpers");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } = await import(
      "@/app/middleware/endpoint-validator"
    );
    const { authenticateRequest } = await import("@/app/api/v1/auth");

    vi.mocked(authenticateRequest).mockResolvedValue(mockApiAuthentication);
    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: false, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: true,
      authenticationMethod: AuthenticationMethod.ApiKey,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);
    const rateLimitError = new Error("Rate limit exceeded");
    rateLimitError.message = "Rate limit exceeded";
    vi.mocked(applyRateLimit).mockRejectedValue(rateLimitError);

    const handler = vi.fn();
    const req = createMockRequest({ url: "https://api.test/v1/management/surveys" });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });

  test("handles sync user identification rate limiting", async () => {
    const { applyRateLimit, applyIPRateLimit } = await import("@/modules/core/rate-limit/helpers");
    const {
      isClientSideApiRoute,
      isManagementApiRoute,
      isIntegrationRoute,
      isSyncWithUserIdentificationEndpoint,
    } = await import("@/app/middleware/endpoint-validator");
    const { authenticateRequest } = await import("@/app/api/v1/auth");

    vi.mocked(isClientSideApiRoute).mockReturnValue({ isClientSideApi: true, isRateLimited: true });
    vi.mocked(isManagementApiRoute).mockReturnValue({
      isManagementApi: false,
      authenticationMethod: AuthenticationMethod.None,
    });
    vi.mocked(isIntegrationRoute).mockReturnValue(false);
    vi.mocked(isSyncWithUserIdentificationEndpoint).mockReturnValue({
      userId: "user-123",
      environmentId: "env-123",
    });
    vi.mocked(authenticateRequest).mockResolvedValue(null);
    vi.mocked(applyIPRateLimit).mockResolvedValue(undefined);
    const rateLimitError = new Error("Sync rate limit exceeded");
    rateLimitError.message = "Sync rate limit exceeded";
    vi.mocked(applyRateLimit).mockRejectedValue(rateLimitError);

    const handler = vi.fn();
    const req = createMockRequest({ url: "/api/v1/client/env-123/app/sync/user-123" });
    const { withV1ApiWrapper } = await import("./with-api-logging");
    const wrapped = withV1ApiWrapper({ handler });
    const res = await wrapped(req, undefined);

    expect(res.status).toBe(429);
    expect(applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ windowMs: 60000, max: 50 }),
      "user-123"
    );
  });

  test("skips audit log creation when no action/targetType provided", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } = (await import(
      "@/modules/ee/audit-logs/lib/handler"
    )) as unknown as { queueAuditEvent: Mock };
    const { authenticateRequest } = await import("@/app/api/v1/auth");
    const { isClientSideApiRoute, isManagementApiRoute, isIntegrationRoute } = await import(
      "@/app/middleware/endpoint-validator"
    );

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

    const req = createMockRequest({ url: "https://api.test/v1/management/surveys" });
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
});

describe("buildAuditLogBaseObject", () => {
  test("creates audit log base object with correct structure", async () => {
    const { buildAuditLogBaseObject } = await import("./with-api-logging");

    const result = buildAuditLogBaseObject("created", "survey", "https://api.test/v1/management/surveys");

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
      apiUrl: "https://api.test/v1/management/surveys",
    });
  });
});
