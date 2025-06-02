import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TActor, TAuditAction, TAuditStatus, TAuditTarget } from "../types/audit-log";
// Import original module to access its original exports for the mock factory
import * as OriginalHandler from "./handler";

// Use 'var' for all mock handles used in vi.mock factories to avoid hoisting/TDZ issues
var serviceLogAuditEventMockHandle: ReturnType<typeof vi.fn>; // NOSONAR / test code
var cacheRunAuditLogHashTransactionMockHandle: ReturnType<typeof vi.fn>; // NOSONAR / test code
var utilsComputeAuditLogHashMockHandle: ReturnType<typeof vi.fn>; // NOSONAR / test code
var loggerErrorMockHandle: ReturnType<typeof vi.fn>; // NOSONAR / test code

// Use 'var' for mutableConstants due to hoisting issues with vi.mock factories
var mutableConstants: { AUDIT_LOG_ENABLED: boolean }; // NOSONAR / test code
// Initialize mutableConstants here, after its declaration, but before vi.mock calls if possible,
// or ensure factories handle potential undefined state if initialization is further down.
// For safety with hoisted mocks, initialize immediately.
mutableConstants = { AUDIT_LOG_ENABLED: true };

vi.mock("@/lib/constants", () => ({
  // AUDIT_LOG_ENABLED will be controlled by mutableConstants
  get AUDIT_LOG_ENABLED() {
    // Guard against mutableConstants being undefined during early hoisting phases if not initialized above
    return mutableConstants ? mutableConstants.AUDIT_LOG_ENABLED : true; // Default to true if somehow undefined
  },
  AUDIT_LOG_GET_USER_IP: true,
  ENCRYPTION_KEY: "testsecret",
}));
vi.mock("@/lib/utils/client-ip", () => ({
  getClientIpFromHeaders: vi.fn().mockResolvedValue("127.0.0.1"),
}));

vi.mock("@/modules/ee/audit-logs/lib/service", () => {
  const mock = vi.fn();
  serviceLogAuditEventMockHandle = mock;
  return { logAuditEvent: mock };
});

vi.mock("./cache", () => {
  const mock = vi.fn((fn) => fn(null).then((res: any) => res.auditEvent())); // Keep original mock logic
  cacheRunAuditLogHashTransactionMockHandle = mock;
  return { runAuditLogHashTransaction: mock };
});

vi.mock("./utils", async () => {
  const actualUtils = await vi.importActual("./utils");
  const mock = vi.fn();
  utilsComputeAuditLogHashMockHandle = mock;
  return {
    ...(actualUtils as object),
    computeAuditLogHash: mock, // This is the one we primarily care about controlling
    redactPII: vi.fn((obj) => obj), // Keep others as simple mocks or actuals if needed
    deepDiff: vi.fn((a, b) => ({ diff: true })),
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
  apiUrl: "/api/test",
};

const fullUser = {
  id: "u1",
  name: "Test User",
  createdAt: new Date(),
  updatedAt: new Date(),
  email: "test@example.com",
  emailVerified: null,
  imageUrl: null,
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
    organizationId: "org1",
    surveyId: "t1",
    oldObject: { foo: "bar" },
    newObject: { foo: "baz" },
    eventId: "event-1",
  },
};

// Helper to clear all mock handles
function clearAllMockHandles() {
  if (serviceLogAuditEventMockHandle) serviceLogAuditEventMockHandle.mockClear().mockResolvedValue(undefined);
  if (cacheRunAuditLogHashTransactionMockHandle)
    cacheRunAuditLogHashTransactionMockHandle
      .mockClear()
      .mockImplementation((fn) => fn(null).then((res: any) => res.auditEvent()));
  if (utilsComputeAuditLogHashMockHandle)
    utilsComputeAuditLogHashMockHandle.mockClear().mockReturnValue("testhash");
  if (loggerErrorMockHandle) loggerErrorMockHandle.mockClear();
  if (mutableConstants) {
    // Check because it's a var and could be re-assigned (though not in this code)
    mutableConstants.AUDIT_LOG_ENABLED = true;
  }
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
    // Now, OriginalHandler.queueAuditEvent will call the REAL OriginalHandler.buildAndLogAuditEvent
    // We expect the MOCKED dependencies of buildAndLogAuditEvent to be called.
    expect(cacheRunAuditLogHashTransactionMockHandle).toHaveBeenCalled();
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    // Add more specific assertions on what serviceLogAuditEventMockHandle was called with if necessary
    // This would be similar to the direct tests for buildAndLogAuditEvent
    const logCall = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(logCall.action).toBe(baseEventParams.action);
    expect(logCall.integrityHash).toBe("testhash");
  });

  test("handles errors from buildAndLogAuditEvent dependencies", async () => {
    const testError = new Error("DB hash error in test");
    cacheRunAuditLogHashTransactionMockHandle.mockImplementationOnce(() => {
      throw testError;
    });
    await OriginalHandler.queueAuditEvent(baseEventParams);
    // queueAuditEvent should catch errors from buildAndLogAuditEvent and log them
    // buildAndLogAuditEvent in turn logs errors from its dependencies
    expect(loggerErrorMockHandle).toHaveBeenCalledWith(testError, "Failed to create audit log event");
    expect(serviceLogAuditEventMockHandle).not.toHaveBeenCalled();
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
    expect(cacheRunAuditLogHashTransactionMockHandle).toHaveBeenCalled();
    expect(serviceLogAuditEventMockHandle).toHaveBeenCalled();
    const logCall = serviceLogAuditEventMockHandle.mock.calls[0][0];
    expect(logCall.action).toBe(baseEventParams.action);
    expect(logCall.integrityHash).toBe("testhash");
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
    expect(callArgs.integrityHash).toBe("testhash");
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

  test("does not log if AUDIT_LOG_ENABLED is false", async () => {
    if (mutableConstants) mutableConstants.AUDIT_LOG_ENABLED = false;
    const handlerImpl = vi.fn().mockResolvedValue("ok");
    const wrapped = OriginalHandler.withAuditLogging("created", "survey", handlerImpl);
    await wrapped({ ctx: mockCtxBase as any, parsedInput: mockParsedInput });
    await new Promise(setImmediate);
    expect(handlerImpl).toHaveBeenCalled();
    expect(serviceLogAuditEventMockHandle).not.toHaveBeenCalled();
    // Reset for other tests; clearAllMockHandles will also do this in the next beforeEach
    if (mutableConstants) mutableConstants.AUDIT_LOG_ENABLED = true;
  });
});
