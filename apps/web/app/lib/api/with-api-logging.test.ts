import { queueAuditEvent as origQueueAuditEvent } from "@/modules/ee/audit-logs/lib/utils";
import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { responses } from "./response";
import { ApiAuditLog, withApiLogging as origWithApiLogging } from "./with-api-logging";

// Mocks
vi.mock("@/modules/ee/audit-logs/lib/utils", () => ({
  queueAuditEvent: vi.fn(),
}));
vi.mock("@/lib/constants", () => ({
  AUDIT_LOG_ENABLED: true,
  IS_PRODUCTION: true,
  SENTRY_DSN: "dsn",
  AUDIT_LOG_PATH: "/tmp/audit.log",
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));
vi.mock("@formbricks/logger", () => {
  const mockWithContext = vi.fn(() => ({ error: vi.fn() }));
  return {
    logger: {
      withContext: mockWithContext,
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
    vi.clearAllMocks();
  });

  test("logs and audits on error response", async () => {
    const handler = vi.fn().mockResolvedValue({
      response: responses.internalServerErrorResponse("fail"),
      audit: { ...baseAudit, event: "fail" },
    });
    const req = createMockRequest({ headers: new Map([["x-request-id", "abc-123"]]) });
    await origWithApiLogging(handler)(req);
    expect(logger.withContext).toHaveBeenCalled();
    expect(origQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "fail", eventId: "abc-123", userType: "api", apiUrl: req.url })
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: expect.objectContaining({ correlationId: "abc-123" }) })
    );
  });

  test("does not log Sentry if not 500", async () => {
    const handler = vi.fn().mockResolvedValue({
      response: responses.badRequestResponse("bad req"),
      audit: { ...baseAudit, status: "failure", event: "bad" },
    });
    const req = createMockRequest();
    await origWithApiLogging(handler)(req);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("logs and audits on thrown error", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("fail!"));
    const req = createMockRequest({ headers: new Map([["x-request-id", "err-1"]]) });
    await expect(origWithApiLogging(handler)(req)).rejects.toThrow("fail!");
    expect(logger.withContext).toHaveBeenCalled();
    expect(origQueueAuditEvent).not.toHaveBeenCalled(); // audit is undefined on thrown error
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: expect.objectContaining({ correlationId: "err-1" }) })
    );
  });

  test("does not log/audit on success response", async () => {
    const handler = vi.fn().mockResolvedValue({
      response: responses.successResponse({ ok: true }),
      audit: { ...baseAudit, status: "success", event: "success" },
    });
    const req = createMockRequest();
    await origWithApiLogging(handler)(req);
    expect(logger.withContext).not.toHaveBeenCalled();
    expect(origQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "success", userType: "api", apiUrl: req.url })
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("does not call audit if AUDIT_LOG_ENABLED is false", async () => {
    vi.resetModules();
    vi.doMock("@/lib/constants", () => ({
      AUDIT_LOG_ENABLED: false,
      IS_PRODUCTION: true,
      SENTRY_DSN: "dsn",
      AUDIT_LOG_PATH: "/tmp/audit.log",
    }));
    const { withApiLogging } = await import("./with-api-logging");
    const { queueAuditEvent } = await import("@/modules/ee/audit-logs/lib/utils");
    const handler = vi.fn().mockResolvedValue({
      response: responses.internalServerErrorResponse("fail"),
      audit: { ...baseAudit, event: "fail" },
    });
    const req = createMockRequest();
    await withApiLogging(handler)(req);
    expect(queueAuditEvent).not.toHaveBeenCalled();
  });
});
