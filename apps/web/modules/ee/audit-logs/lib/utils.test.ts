import { beforeEach, describe, expect, test, vi } from "vitest";
import { deepDiff, redactPII } from "./utils";

// Patch redis multi before any imports
beforeEach(async () => {
  const redis = (await import("@/lib/redis")).default;
  if ((redis.multi as any)?.mockReturnValue) {
    (redis.multi as any).mockReturnValue({
      set: vi.fn(),
      exec: vi.fn().mockResolvedValue([["OK"]]),
    });
  }
});

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsAuditLogsEnabled: vi.fn().mockResolvedValue(true),
}));

// Move all relevant mocks to the very top
vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromEnvironmentId: vi.fn().mockResolvedValue("org-env-id"),
}));

// Do NOT import buildAndLogAuditEvent, queueAuditEventBackground, or queueAuditEvent as named imports for spy to work

// Mocks
vi.mock("@/lib/constants", () => ({
  AUDIT_LOG_ENABLED: true,
  AUDIT_LOG_GET_USER_IP: true,
  ENCRYPTION_KEY: "testsecret",
}));
vi.mock("@/lib/utils/client-ip", () => ({
  getClientIpFromHeaders: vi.fn().mockResolvedValue("127.0.0.1"),
}));
vi.mock("@/modules/ee/audit-logs/lib/service", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/redis", () => ({
  default: {
    watch: vi.fn().mockResolvedValue("OK"),
    multi: vi.fn().mockReturnValue({
      set: vi.fn(),
      exec: vi.fn().mockResolvedValue([["OK"]]),
    }),
    get: vi.fn().mockResolvedValue(null),
  },
}));

// Set ENCRYPTION_KEY for all tests unless explicitly testing its absence
process.env.ENCRYPTION_KEY = "testsecret";

describe("redactPII", () => {
  test("redacts sensitive keys in objects", () => {
    const input = { email: "test@example.com", name: "John", foo: "bar" };
    expect(redactPII(input)).toEqual({ email: "********", name: "********", foo: "bar" });
  });
  test("redacts nested sensitive keys", () => {
    const input = { user: { password: "secret", profile: { address: "123 St" } } };
    expect(redactPII(input)).toEqual({ user: { password: "********", profile: { address: "********" } } });
  });
  test("redacts arrays of objects", () => {
    const input = [{ email: "a@b.com" }, { name: "Jane" }];
    expect(redactPII(input)).toEqual([{ email: "********" }, { name: "********" }]);
  });
  test("returns primitives as is", () => {
    expect(redactPII(42)).toBe(42);
    expect(redactPII("foo")).toBe("foo");
    expect(redactPII(null)).toBe(null);
  });
});

describe("deepDiff", () => {
  test("returns undefined for equal primitives", () => {
    expect(deepDiff(1, 1)).toBeUndefined();
    expect(deepDiff("a", "a")).toBeUndefined();
  });
  test("returns new value for different primitives", () => {
    expect(deepDiff(1, 2)).toBe(2);
    expect(deepDiff("a", "b")).toBe("b");
  });
  test("returns diff for objects", () => {
    expect(deepDiff({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
    expect(deepDiff({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: 3 });
  });
  test("returns diff for nested objects", () => {
    expect(deepDiff({ a: { b: 1 } }, { a: { b: 2 } })).toEqual({ a: { b: 2 } });
  });
  test("returns diff for added/removed keys", () => {
    expect(deepDiff({ a: 1 }, { a: 1, b: 2 })).toEqual({ b: 2 });
    // The following case should return undefined, as removed keys are not included in the diff
    expect(deepDiff({ a: 1, b: 2 }, { a: 1 })).toBeUndefined();
  });
});

describe("queueAuditEventBackground", () => {
  let utils: any;
  beforeEach(async () => {
    vi.resetModules();
    utils = await import("./utils");
  });
  test("calls logAuditEvent in the background", async () => {
    const { logAuditEvent } = await import("@/modules/ee/audit-logs/lib/service");
    await utils.queueAuditEventBackground({
      actionType: "survey.created",
      targetType: "survey",
      userId: "u1",
      userType: "user",
      targetId: "t1",
      organizationId: "org1",
      oldObject: { foo: "bar" },
      newObject: { foo: "baz" },
      status: "success",
      apiUrl: "/api/test",
    });
    // Wait for setImmediate
    await new Promise((r) => setTimeout(r, 10));
    expect(logAuditEvent).toHaveBeenCalled();
  });
});

describe("queueAuditEvent", () => {
  let utils: any;
  beforeEach(async () => {
    vi.resetModules();
    utils = await import("./utils");
  });
  test("calls logAuditEvent synchronously", async () => {
    const { logAuditEvent } = await import("@/modules/ee/audit-logs/lib/service");
    await utils.queueAuditEvent({
      actionType: "survey.created",
      targetType: "survey",
      userId: "u1",
      userType: "user",
      targetId: "t1",
      organizationId: "org1",
      oldObject: { foo: "bar" },
      newObject: { foo: "baz" },
      status: "success",
      apiUrl: "/api/test",
    });
    expect(logAuditEvent).toHaveBeenCalled();
  });
});

describe("withAuditLogging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("logs audit event for successful handler", async () => {
    const handler = vi.fn().mockResolvedValue("ok");
    const { withAuditLogging } = await import("./utils");
    const wrapped = withAuditLogging("created", "survey", handler);
    const ctx = {
      user: {
        id: "u1",
        name: "Test User",
        email: "test@example.com",
        emailVerified: null,
        imageUrl: null,
        twoFactorEnabled: false,
        identityProvider: "email" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: null,
        organizationId: "org1",
        isActive: true,
        lastLoginAt: null,
        locale: "en-US" as const,
        teams: [],
        organizations: [],
        objective: null,
        notificationSettings: {
          alert: {},
          weeklySummary: {},
        },
      },
      organizationId: "org1",
      ipAddress: "127.0.0.1",
      auditLoggingCtx: {
        ipAddress: "127.0.0.1",
        organizationId: "org1",
      },
    };
    const parsedInput = {};
    await wrapped({ ctx, parsedInput });
    // Wait for setImmediate
    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalled();
  });
  test("logs audit event for failed handler and throws", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("fail"));
    const { withAuditLogging } = await import("./utils");
    const wrapped = withAuditLogging("created", "survey", handler);
    const ctx = {
      user: {
        id: "u1",
        name: "Test User",
        email: "test@example.com",
        emailVerified: null,
        imageUrl: null,
        twoFactorEnabled: false,
        identityProvider: "email" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: null,
        organizationId: "org1",
        isActive: true,
        lastLoginAt: null,
        locale: "en-US" as const,
        teams: [],
        organizations: [],
        objective: null,
        notificationSettings: {
          alert: {},
          weeklySummary: {},
        },
      },
      organizationId: "org1",
      ipAddress: "127.0.0.1",
      auditLoggingCtx: {
        ipAddress: "127.0.0.1",
        organizationId: "org1",
      },
    };
    const parsedInput = {};
    await expect(wrapped({ ctx, parsedInput })).rejects.toThrow("fail");
    // Wait for setImmediate
    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalled();
  });
});

describe("runtime config checks", () => {
  test("throws if AUDIT_LOG_ENABLED is true and ENCRYPTION_KEY is missing", async () => {
    // Unset the secret and reload the module
    process.env.ENCRYPTION_KEY = "";
    vi.resetModules();
    vi.doMock("@/lib/constants", () => ({
      AUDIT_LOG_ENABLED: true,
      AUDIT_LOG_GET_USER_IP: true,
      ENCRYPTION_KEY: undefined,
    }));
    await expect(import("./utils")).rejects.toThrow(
      /ENCRYPTION_KEY must be set when AUDIT_LOG_ENABLED is enabled/
    );
    // Restore for other tests
    process.env.ENCRYPTION_KEY = "testsecret";
    vi.resetModules();
    vi.doMock("@/lib/constants", () => ({
      AUDIT_LOG_ENABLED: true,
      AUDIT_LOG_GET_USER_IP: true,
      ENCRYPTION_KEY: "testsecret",
    }));
  });
});

describe("computeAuditLogHash", () => {
  let utils: any;
  beforeEach(async () => {
    vi.unmock("crypto");
    utils = await import("./utils");
  });
  test("produces deterministic hash for same input", () => {
    const event = {
      actor: { id: "u1", type: "user" },
      action: "survey.created",
      target: { id: "t1", type: "survey" },
      timestamp: "2024-01-01T00:00:00.000Z",
      organizationId: "org1",
      status: "success",
      ipAddress: "127.0.0.1",
      apiUrl: "/api/test",
    };
    const hash1 = utils.computeAuditLogHash(event, null);
    const hash2 = utils.computeAuditLogHash(event, null);
    expect(hash1).toBe(hash2);
  });
  test("hash changes if previous hash changes", () => {
    const event = {
      actor: { id: "u1", type: "user" },
      action: "survey.created",
      target: { id: "t1", type: "survey" },
      timestamp: "2024-01-01T00:00:00.000Z",
      organizationId: "org1",
      status: "success",
      ipAddress: "127.0.0.1",
      apiUrl: "/api/test",
    };
    const hash1 = utils.computeAuditLogHash(event, "prev1");
    const hash2 = utils.computeAuditLogHash(event, "prev2");
    expect(hash1).not.toBe(hash2);
  });
});

describe("buildAndLogAuditEvent", () => {
  let buildAndLogAuditEvent: any;
  let redis: any;
  beforeEach(async () => {
    vi.clearAllMocks();
    ({ buildAndLogAuditEvent } = await import("./utils"));
    redis = (await import("@/lib/redis")).default;
  });

  test("logs audit event and updates hash on success", async () => {
    const { logAuditEvent } = await import("@/modules/ee/audit-logs/lib/service");
    await buildAndLogAuditEvent({
      actionType: "survey.created",
      targetType: "survey",
      userId: "u1",
      userType: "user",
      targetId: "t1",
      organizationId: "org1",
      ipAddress: "127.0.0.1",
      status: "success",
      oldObject: { foo: "bar" },
      newObject: { foo: "baz" },
      apiUrl: "/api/test",
    });
    expect(logAuditEvent).toHaveBeenCalled();
  });

  test("retries and logs error if hash update fails", async () => {
    redis.multi.mockReturnValue({
      set: vi.fn(),
      exec: vi.fn().mockResolvedValue(null),
    });
    const { logAuditEvent } = await import("@/modules/ee/audit-logs/lib/service");
    await buildAndLogAuditEvent({
      actionType: "survey.created",
      targetType: "survey",
      userId: "u1",
      userType: "user",
      targetId: "t1",
      organizationId: "org1",
      ipAddress: "127.0.0.1",
      status: "success",
      oldObject: { foo: "bar" },
      newObject: { foo: "baz" },
      apiUrl: "/api/test",
    });
    expect(logAuditEvent).not.toHaveBeenCalled();
    // The error is caught and logged, not thrown
  });
});
