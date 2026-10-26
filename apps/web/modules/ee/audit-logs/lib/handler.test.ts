import { headers } from "next/headers";
import { after } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { queueV3AuditLog } from "@/app/api/v3/lib/audit";
import type { ActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { getIsAuditLogsEnabled } from "@/modules/ee/license-check/lib/utils";
import { TActor, TAuditAction, TAuditStatus, TAuditTarget } from "../types/audit-log";
// Import original module to access its original exports for the mock factory
import * as OriginalHandler from "./handler";

// Use 'var' for all mock handles used in vi.mock factories to avoid hoisting/TDZ issues
var serviceLogAuditEventMockHandle: ReturnType<typeof vi.fn>; // NOSONAR / test code
var loggerErrorMockHandle: ReturnType<typeof vi.fn>; // NOSONAR / test code

// The env var, the licence and Cloud are combined by getIsAuditLogsEnabled (tested in
// license-check/lib/utils.test.ts). Here it is the only switch, so every entry point is held to it.
const { auditGate } = vi.hoisted(() => ({ auditGate: { enabled: true } }));

// next/server's after() runs its callback once the response is sent; collect them so a test can flush.
const { afterCallbacks } = vi.hoisted(() => ({ afterCallbacks: [] as Promise<unknown>[] }));

vi.mock("@/app/lib/api/with-api-logging", () => ({ buildAuditLogBaseObject: vi.fn() }));

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => Promise<unknown>) => {
    afterCallbacks.push(Promise.resolve().then(callback));
  }),
}));

const flushAfter = async () => {
  await Promise.all(afterCallbacks.splice(0));
};

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsAuditLogsEnabled: vi.fn(async () => auditGate.enabled),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    // Set, so a disabled gate is the only reason an event is skipped
    AUDIT_LOG_ENABLED: true,
    AUDIT_LOG_GET_USER_IP: true,
  };
});
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "user-agent": "audit-test-agent" })),
}));

vi.mock("@/lib/utils/client-ip", () => ({
  getClientIpFromHeaders: vi.fn().mockResolvedValue("127.0.0.1"),
  UNTRUSTED_CLIENT_IP: "untrusted-client-ip",
}));

vi.mock("@/modules/ee/audit-logs/lib/service", () => {
  const mock = vi.fn();
  serviceLogAuditEventMockHandle = mock;
  return { logAuditEvent: mock };
});

vi.mock("./utils", async () => {
  const actualUtils = await vi.importActual("./utils");
  return {
    ...(actualUtils as object),
    redactPII: vi.fn((obj) => obj), // Keep others as simple mocks or actuals if needed
    deepDiff: vi.fn((_a: unknown, _b: unknown) => ({ diff: true })),
  };
});

// Special handling for @formbricks/logger due to hoisting issues
vi.mock("@formbricks/logger", () => {
  const localLoggerErrorMock = vi.fn();
  loggerErrorMockHandle = localLoggerErrorMock;
  return {
    logger: {
      error: localLoggerErrorMock,
      // Ensure other logger methods are available if needed, or mock them as vi.fn()
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      fatal: vi.fn(),
      withContext: vi.fn(() => ({
        // basic stub for withContext
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: localLoggerErrorMock,
        fatal: vi.fn(),
      })),
      request: vi.fn(() => ({
        // basic stub for request
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: localLoggerErrorMock,
        fatal: vi.fn(),
      })),
    },
  };
});

const baseEventParams = {
  action: "created" as TAuditAction,
  targetType: "survey" as TAuditTarget,
  userId: "u1",
  userType: "user" as TActor,
  targetId: "t1",
  organizationId: "org1",
  ipAddress: "127.0.0.1",
  status: "success" as TAuditStatus,
  oldObject: { foo: "bar" },
  newObject: { foo: "baz" },
  // Absolute: the schema validates apiUrl with z.url(). This file mocks the service out, so a bare
  // path would pass here while being dropped in production (see service.test.ts).
  apiUrl: "http://localhost:3000/api/test",
};

const fullUser = {
  id: "u1",
  name: "Test User",
  createdAt: new Date(),
  updatedAt: new Date(),
  email: "test@example.com",
  emailVerified: null,
  twoFactorEnabled: false,
  identityProvider: "email",
  organizationId: "org1",
  isActive: true,
  lastLoginAt: new Date(),
  locale: "en",
  notificationSettings: {},
  onboardingDisplayed: true,
  productId: "p1",
  role: "user",
  source: null,
  teams: [],
  type: "user",
  objective: null,
  intention: null,
};

const mockCtxBase = {
  user: fullUser,
  auditLoggingCtx: {
    ipAddress: "127.0.0.1",
    userAgent: "action-test-agent",
    organizationId: "org1",
    surveyId: "t1",
    oldObject: { foo: "bar" },
    newObject: { foo: "baz" },
    eventId: "event-1",
  },
};

// The fixtures carry only the fields withAuditLogging reads, not a full action context
const asActionCtx = (ctx: object) => ctx as unknown as ActionClientCtx;

// Helper to clear all mock handles
function clearAllMockHandles() {
  if (serviceLogAuditEventMockHandle) serviceLogAuditEventMockHandle.mockClear().mockResolvedValue(undefined);
  if (loggerErrorMockHandle) loggerErrorMockHandle.mockClear();
  vi.mocked(getClientIpFromHeaders).mockResolvedValue("127.0.0.1");
  vi.mocked(headers).mockResolvedValue(new Headers({ "user-agent": "audit-test-agent" }) as never);
  auditGate.enabled = true;
}

describe("queueAuditEvent", () => {
  beforeEach(() => {
    clearAllMockHandles();
  });
  afterEach(() => {
    vi.resetModules(); // Reset if any dynamic imports were used, or for general cleanliness
  });

  test("correctly processes event and its dependencies are called", async () => {
    await OriginalHandler.queueAuditEvent(baseEventParams);
    await flushAfter();
    // queueAuditEvent runs the module's real event builder; only its dependencies are mocked.
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    // Add more specific assertions on what serviceLogAuditEventMockHandle was called with if necessary
    const logCall = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(logCall.action).toBe(baseEventParams.action);
  });

  test("handles errors from buildAndLogAuditEvent dependencies", async () => {
    const testError = new Error("Service error in test");
    serviceLogAuditEventMockHandle.mockImplementationOnce(() => {
      throw testError;
    });
    await OriginalHandler.queueAuditEvent(baseEventParams);
    await flushAfter();
    // queueAuditEvent should catch errors from buildAndLogAuditEvent and log them
    // buildAndLogAuditEvent in turn logs errors from its dependencies
    expect(loggerErrorMockHandle).toHaveBeenCalledWith(testError, "Failed to create audit log event");
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
  });

  test("does nothing when audit logging is disabled, not even the IP read", async () => {
    auditGate.enabled = false;
    await OriginalHandler.queueAuditEvent(baseEventParams);
    await flushAfter();
    expect(serviceLogAuditEventMockHandle).not.toHaveBeenCalled();
    expect(vi.mocked(getClientIpFromHeaders)).not.toHaveBeenCalled();
  });

  test("returns before the licence check settles, then logs with the time of the call", async () => {
    let settleGate!: (enabled: boolean) => void;
    vi.mocked(getIsAuditLogsEnabled).mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (settleGate = resolve))
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-20T10:00:00.000Z"));
      const outcome = await Promise.race([
        OriginalHandler.queueAuditEvent(baseEventParams).then(() => "returned"),
        new Promise((resolve) => setTimeout(() => resolve("still waiting on the licence"), 50)),
      ]);
      expect(outcome).toBe("returned");
      expect(serviceLogAuditEventMockHandle).not.toHaveBeenCalled();

      vi.setSystemTime(new Date("2026-10-20T10:00:30.000Z"));
      settleGate(true);
      await flushAfter();
    } finally {
      vi.useRealTimers();
    }
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: "2026-10-20T10:00:00.000Z" })
    );
  });

  test("rejects, rather than throws, when after() is called outside a request scope", async () => {
    const scopeError = new Error("after() was called outside a request scope");
    vi.mocked(after).mockImplementationOnce(() => {
      throw scopeError;
    });
    let pending: Promise<void> | undefined;
    expect(() => {
      pending = OriginalHandler.queueAuditEvent(baseEventParams);
    }).not.toThrow();
    await expect(pending).rejects.toBe(scopeError);
  });

  test("preserves the audit event when the deferred IP read fails", async () => {
    const ipError = new Error("headers unavailable");
    vi.mocked(getClientIpFromHeaders).mockRejectedValueOnce(ipError);
    await OriginalHandler.queueAuditEvent(baseEventParams);
    await flushAfter();
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: "untrusted-client-ip", userAgent: "audit-test-agent" })
    );
  });
});

describe("queueAuditEventBackground", () => {
  beforeEach(() => {
    clearAllMockHandles();
  });
  afterEach(() => {
    vi.resetModules();
  });

  test("correctly processes event in background and dependencies are called", async () => {
    await OriginalHandler.queueAuditEventBackground(baseEventParams);
    await new Promise(setImmediate); // Wait for setImmediate to run
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    const logCall = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(logCall.action).toBe(baseEventParams.action);
  });

  test("retains its snapshot after request headers stop being readable", async () => {
    await OriginalHandler.queueAuditEventBackground(baseEventParams);
    vi.mocked(headers).mockRejectedValue(new Error("request has ended"));
    await new Promise(setImmediate);
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: "127.0.0.1",
        userAgent: "audit-test-agent",
      })
    );
    expect(headers).toHaveBeenCalledTimes(1);
  });

  test("does not write when the licence gate disables audit logging", async () => {
    auditGate.enabled = false;
    await OriginalHandler.queueAuditEventBackground(baseEventParams);
    await new Promise(setImmediate);
    expect(serviceLogAuditEventMockHandle).not.toHaveBeenCalled();
  });

  test("preserves the audit event when the IP read fails", async () => {
    const ipError = new Error("headers unavailable");
    vi.mocked(getClientIpFromHeaders).mockRejectedValueOnce(ipError);
    await OriginalHandler.queueAuditEventBackground(baseEventParams);
    await new Promise(setImmediate);
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: "untrusted-client-ip", userAgent: "audit-test-agent" })
    );
  });
});

describe("queueAuditEventWithoutRequest", () => {
  beforeEach(() => {
    clearAllMockHandles();
  });
  afterEach(() => {
    vi.resetModules();
  });

  test("logs audit events without reading request headers", async () => {
    await OriginalHandler.queueAuditEventWithoutRequest({
      ...baseEventParams,
      requestMetadata: { ipAddress: "203.0.113.7", userAgent: "deferred-agent" },
    });

    expect(serviceLogAuditEventMockHandle).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: "203.0.113.7", userAgent: "deferred-agent" })
    );
    expect(vi.mocked(getClientIpFromHeaders)).not.toHaveBeenCalled();
  });

  test("system events carry explicit unknown metadata without reading headers", async () => {
    await OriginalHandler.queueAuditEventWithoutRequest({ ...baseEventParams, userType: "system" });
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { id: "u1", type: "system" },
        ipAddress: "unknown",
        userAgent: "unknown",
      })
    );
    expect(getClientIpFromHeaders).not.toHaveBeenCalled();
  });

  test("does nothing when audit logging is disabled", async () => {
    auditGate.enabled = false;
    await OriginalHandler.queueAuditEventWithoutRequest(baseEventParams);
    expect(serviceLogAuditEventMockHandle).not.toHaveBeenCalled();
  });
});

describe("withAuditLogging", () => {
  beforeEach(() => {
    clearAllMockHandles();
  });
  afterEach(() => {
    vi.resetModules();
  });

  const mockParsedInput = {};

  test("logs audit event for successful handler", async () => {
    const handlerImpl = vi.fn().mockResolvedValue("ok");
    const wrapped = OriginalHandler.withAuditLogging("created", "survey", handlerImpl);
    await wrapped({ ctx: mockCtxBase as any, parsedInput: mockParsedInput });
    await new Promise(setImmediate);
    expect(handlerImpl).toHaveBeenCalled();
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    const callArgs = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(callArgs.action).toBe("created");
    expect(callArgs.status).toBe("success");
    expect(callArgs.target.id).toBe("t1");
  });

  test("logs audit event for failed handler and throws", async () => {
    const handlerImpl = vi.fn().mockRejectedValue(new Error("fail"));
    const wrapped = OriginalHandler.withAuditLogging("created", "survey", handlerImpl);
    await expect(wrapped({ ctx: mockCtxBase as any, parsedInput: mockParsedInput })).rejects.toThrow("fail");
    await new Promise(setImmediate);
    expect(handlerImpl).toHaveBeenCalled();
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    const callArgs = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(callArgs.action).toBe("created");
    expect(callArgs.status).toBe("failure");
    expect(callArgs.target.id).toBe("t1");
  });

  // ENG-2091: `action` is fixed when the wrapper is applied, so a handler whose success does NOT mean
  // the audited thing happened (a duplicate sign-up answering identically to a real one) would otherwise
  // record a false `created`.
  test("skips the event when a successful handler sets suppressEvent", async () => {
    const suppressedCtx = {
      ...mockCtxBase,
      auditLoggingCtx: { ...mockCtxBase.auditLoggingCtx, suppressEvent: true },
    };
    const handlerImpl = vi.fn().mockResolvedValue("ok");
    const wrapped = OriginalHandler.withAuditLogging("created", "user", handlerImpl);

    const result = await wrapped({ ctx: suppressedCtx as any, parsedInput: mockParsedInput });
    await new Promise(setImmediate);

    expect(result).toBe("ok"); // the response is unchanged — only the record is
    expect(handlerImpl).toHaveBeenCalled();
    expect(serviceLogAuditEventMockHandle).not.toHaveBeenCalled();
  });

  // The flag must never be usable to hide a failure, so it is honoured only on the success path.
  test("still logs a FAILED handler even when suppressEvent is set", async () => {
    const suppressedCtx = {
      ...mockCtxBase,
      auditLoggingCtx: { ...mockCtxBase.auditLoggingCtx, suppressEvent: true },
    };
    const handlerImpl = vi.fn().mockRejectedValue(new Error("fail"));
    const wrapped = OriginalHandler.withAuditLogging("created", "user", handlerImpl);

    await expect(wrapped({ ctx: suppressedCtx as any, parsedInput: mockParsedInput })).rejects.toThrow(
      "fail"
    );
    await new Promise(setImmediate);

    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    expect(serviceLogAuditEventMockHandle.mock.calls[0][0].status).toBe("failure");
  });

  test("does not log when audit logging is disabled", async () => {
    auditGate.enabled = false;
    const handlerImpl = vi.fn().mockResolvedValue("ok");
    const wrapped = OriginalHandler.withAuditLogging("created", "survey", handlerImpl);
    await expect(wrapped({ ctx: asActionCtx(mockCtxBase), parsedInput: mockParsedInput })).resolves.toBe(
      "ok"
    );
    await new Promise(setImmediate);
    expect(handlerImpl).toHaveBeenCalled();
    expect(serviceLogAuditEventMockHandle).not.toHaveBeenCalled();
  });

  test("still rethrows a failed handler when audit logging is disabled", async () => {
    auditGate.enabled = false;
    const handlerImpl = vi.fn().mockRejectedValue(new Error("fail"));
    const wrapped = OriginalHandler.withAuditLogging("created", "survey", handlerImpl);
    await expect(wrapped({ ctx: asActionCtx(mockCtxBase), parsedInput: mockParsedInput })).rejects.toThrow(
      "fail"
    );
    await new Promise(setImmediate);
    expect(serviceLogAuditEventMockHandle).not.toHaveBeenCalled();
  });

  test("rethrows a failed handler that has no audit logging context", async () => {
    const handlerImpl = vi.fn().mockRejectedValue(new Error("fail"));
    const wrapped = OriginalHandler.withAuditLogging("created", "survey", handlerImpl);
    await expect(
      wrapped({ ctx: asActionCtx({ user: fullUser }), parsedInput: mockParsedInput })
    ).rejects.toThrow("fail");
    await new Promise(setImmediate);
    expect(loggerErrorMockHandle).toHaveBeenCalledWith("No audit logging context found");
    expect(serviceLogAuditEventMockHandle).not.toHaveBeenCalled();
  });

  test("resolves targetId for chart target type", async () => {
    const chartCtx = {
      ...mockCtxBase,
      auditLoggingCtx: { ...mockCtxBase.auditLoggingCtx, chartId: "chart-1" },
    };
    const handlerImpl = vi.fn().mockResolvedValue("ok");
    const wrapped = OriginalHandler.withAuditLogging("created", "chart", handlerImpl);
    await wrapped({ ctx: chartCtx as any, parsedInput: mockParsedInput });
    await new Promise(setImmediate);
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    const callArgs = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(callArgs.target.type).toBe("chart");
    expect(callArgs.target.id).toBe("chart-1");
  });

  test("resolves targetId for feedback source target type", async () => {
    const feedbackSourceCtx = {
      ...mockCtxBase,
      auditLoggingCtx: { ...mockCtxBase.auditLoggingCtx, feedbackSourceId: "feedback-source-1" },
    };
    const handlerImpl = vi.fn().mockResolvedValue("ok");
    const wrapped = OriginalHandler.withAuditLogging("created", "feedbackSource", handlerImpl);
    await wrapped({ ctx: feedbackSourceCtx as any, parsedInput: mockParsedInput });
    await new Promise(setImmediate);
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    const callArgs = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(callArgs.target.type).toBe("feedbackSource");
    expect(callArgs.target.id).toBe("feedback-source-1");
  });

  test("resolves targetId for embedded data target type", async () => {
    const embeddedDataCtx = {
      ...mockCtxBase,
      auditLoggingCtx: { ...mockCtxBase.auditLoggingCtx, embeddedDataId: "embedded-data-1" },
    };
    const handlerImpl = vi.fn().mockResolvedValue("ok");
    const wrapped = OriginalHandler.withAuditLogging("created", "embeddedData", handlerImpl);
    await wrapped({ ctx: embeddedDataCtx as any, parsedInput: mockParsedInput });
    await new Promise(setImmediate);
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    const callArgs = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(callArgs.target.type).toBe("embeddedData");
    expect(callArgs.target.id).toBe("embedded-data-1");
  });

  test("resolves targetId for dashboard target type", async () => {
    const dashCtx = {
      ...mockCtxBase,
      auditLoggingCtx: { ...mockCtxBase.auditLoggingCtx, dashboardId: "dash-1" },
    };
    const handlerImpl = vi.fn().mockResolvedValue("ok");
    const wrapped = OriginalHandler.withAuditLogging("created", "dashboard", handlerImpl);
    await wrapped({ ctx: dashCtx as any, parsedInput: mockParsedInput });
    await new Promise(setImmediate);
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    const callArgs = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(callArgs.target.type).toBe("dashboard");
    expect(callArgs.target.id).toBe("dash-1");
  });

  test("resolves targetId for dashboardWidget target type", async () => {
    const widgetCtx = {
      ...mockCtxBase,
      auditLoggingCtx: { ...mockCtxBase.auditLoggingCtx, dashboardWidgetId: "widget-1" },
    };
    const handlerImpl = vi.fn().mockResolvedValue("ok");
    const wrapped = OriginalHandler.withAuditLogging("created", "dashboardWidget", handlerImpl);
    await wrapped({ ctx: widgetCtx as any, parsedInput: mockParsedInput });
    await new Promise(setImmediate);
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    const callArgs = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(callArgs.target.type).toBe("dashboardWidget");
    expect(callArgs.target.id).toBe("widget-1");
  });
});

describe("v3 and MCP audit emission", () => {
  beforeEach(clearAllMockHandles);

  test.each(["success", "failure"] as const)(
    "retains metadata for %s API-key and MCP events",
    async (status) => {
      const { logger } = await import("@formbricks/logger");
      await queueV3AuditLog(
        {
          ...baseEventParams,
          userId: "api-key-1",
          userType: "api",
          status,
          apiUrl: "https://app.example.com/api/mcp",
        },
        "request-1",
        logger.withContext({})
      );
      await flushAfter();
      expect(serviceLogAuditEventMockHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: { id: "api-key-1", type: "api" },
          status,
          ipAddress: "127.0.0.1",
          userAgent: "audit-test-agent",
          ...(status === "failure" ? { eventId: "request-1" } : {}),
        })
      );
    }
  );
});
