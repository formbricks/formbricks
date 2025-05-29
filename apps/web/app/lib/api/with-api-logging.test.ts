import * as Sentry from "@sentry/nextjs";
import { Mock, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { responses } from "./response";
import { ApiAuditLog } from "./with-api-logging";

// Mocks
// This top-level mock is crucial for the SUT (withApiLogging.ts)
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
      // These are for direct calls like logger.error(), logger.warn()
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  };
});

function createMockRequest({ method = "GET", url = "https://api.test/endpoint", headers = new Map() } = {}) {
  return {
    method,
    url,
    headers: {
      get: (key: string) => headers.get(key),
    },
  } as unknown as Request;
}

// Minimal valid ApiAuditLog
const baseAudit: ApiAuditLog = {
  actionType: "survey.created",
  targetType: "survey",
  userId: "user-1",
  targetId: "target-1",
  organizationId: "org-1",
  status: "failure",
};

describe("withApiLogging", () => {
  beforeEach(() => {
    vi.resetModules(); // Reset SUT and other potentially cached modules
    // vi.doMock for constants if a specific test needs to override it
    // The top-level mocks for audit-logs, sentry, logger should be re-applied implicitly
    // or are already in place due to vi.mock hoisting.

    // Restore the mock for constants to its default for most tests
    vi.doMock("@/lib/constants", () => ({
      AUDIT_LOG_ENABLED: true,
      IS_PRODUCTION: true,
      SENTRY_DSN: "dsn",
      AUDIT_LOG_PATH: "/tmp/audit.log",
      ENCRYPTION_KEY: "test-key",
      REDIS_URL: "redis://localhost:6379",
    }));

    vi.clearAllMocks(); // Clear call counts etc. for all vi.fn()
  });

  test("logs and audits on error response", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } = (await import(
      "@/modules/ee/audit-logs/lib/handler"
    )) as unknown as { queueAuditEvent: Mock };
    const handler = vi.fn().mockResolvedValue({
      response: responses.internalServerErrorResponse("fail"),
      audit: { ...baseAudit, event: "fail" },
    });
    const req = createMockRequest({ headers: new Map([["x-request-id", "abc-123"]]) });
    const { withApiLogging } = await import("./with-api-logging"); // SUT dynamically imported
    await withApiLogging(handler)(req);
    expect(logger.withContext).toHaveBeenCalled();
    expect(mockContextualLoggerError).toHaveBeenCalled();
    expect(mockContextualLoggerWarn).not.toHaveBeenCalled();
    expect(mockContextualLoggerInfo).not.toHaveBeenCalled();
    expect(mockedQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "fail", eventId: "abc-123", userType: "api", apiUrl: req.url })
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
    const handler = vi.fn().mockResolvedValue({
      response: responses.badRequestResponse("bad req"),
      audit: { ...baseAudit, status: "failure", event: "bad" },
    });
    const req = createMockRequest();
    const { withApiLogging } = await import("./with-api-logging");
    await withApiLogging(handler)(req);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(logger.withContext).toHaveBeenCalled();
    expect(mockContextualLoggerError).toHaveBeenCalled();
    expect(mockContextualLoggerWarn).not.toHaveBeenCalled();
    expect(mockContextualLoggerInfo).not.toHaveBeenCalled();
    expect(mockedQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "bad", userType: "api", apiUrl: req.url })
    );
  });

  test("logs and audits on thrown error", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } = (await import(
      "@/modules/ee/audit-logs/lib/handler"
    )) as unknown as { queueAuditEvent: Mock };
    const handler = vi.fn().mockRejectedValue(new Error("fail!"));
    const req = createMockRequest({ headers: new Map([["x-request-id", "err-1"]]) });
    const { withApiLogging } = await import("./with-api-logging");
    const res = await withApiLogging(handler)(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      code: "internal_server_error",
      message: "An unexpected error occurred.",
      details: {},
    });
    expect(logger.withContext).toHaveBeenCalled();
    expect(mockContextualLoggerError).toHaveBeenCalled();
    expect(mockContextualLoggerWarn).not.toHaveBeenCalled();
    expect(mockContextualLoggerInfo).not.toHaveBeenCalled();
    expect(mockedQueueAuditEvent).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: expect.objectContaining({ correlationId: "err-1" }) })
    );
  });

  test("does not log/audit on success response", async () => {
    const { queueAuditEvent: mockedQueueAuditEvent } = (await import(
      "@/modules/ee/audit-logs/lib/handler"
    )) as unknown as { queueAuditEvent: Mock };
    const handler = vi.fn().mockResolvedValue({
      response: responses.successResponse({ ok: true }),
      audit: { ...baseAudit, status: "success", event: "success" },
    });
    const req = createMockRequest();
    const { withApiLogging } = await import("./with-api-logging");
    await withApiLogging(handler)(req);
    expect(logger.withContext).not.toHaveBeenCalled();
    expect(mockContextualLoggerError).not.toHaveBeenCalled();
    expect(mockContextualLoggerWarn).not.toHaveBeenCalled();
    expect(mockContextualLoggerInfo).not.toHaveBeenCalled();
    expect(mockedQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "success", userType: "api", apiUrl: req.url })
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("does not call audit if AUDIT_LOG_ENABLED is false", async () => {
    // For this specific test, we override the AUDIT_LOG_ENABLED constant
    vi.doMock("@/lib/constants", () => ({
      AUDIT_LOG_ENABLED: false,
      IS_PRODUCTION: true,
      SENTRY_DSN: "dsn",
      AUDIT_LOG_PATH: "/tmp/audit.log",
      ENCRYPTION_KEY: "test-key",
      REDIS_URL: "redis://localhost:6379",
    }));

    const { queueAuditEvent: mockedQueueAuditEvent } = (await import(
      "@/modules/ee/audit-logs/lib/handler"
    )) as unknown as { queueAuditEvent: Mock };
    const { withApiLogging } = await import("./with-api-logging");

    const handler = vi.fn().mockResolvedValue({
      response: responses.internalServerErrorResponse("fail"),
      audit: { ...baseAudit, event: "fail" },
    });
    const req = createMockRequest();
    await withApiLogging(handler)(req);
    expect(mockedQueueAuditEvent).not.toHaveBeenCalled();
  });
});
