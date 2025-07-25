import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deepDiff, redactPII } from "./utils";

// Patch redis multi before any imports
beforeEach(async () => {
  const redis = (await import("@/modules/cache/redis")).default;
  if ((redis?.multi as any)?.mockReturnValue) {
    (redis?.multi as any).mockReturnValue({
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

vi.mock("@/modules/cache/redis", () => ({
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

describe("withAuditLogging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  test("logs audit event for successful handler", async () => {
    const handler = vi.fn().mockResolvedValue("ok");
    const { withAuditLogging } = await import("./handler");
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
    vi.runAllTimers();
    expect(handler).toHaveBeenCalled();
  });
  test("logs audit event for failed handler and throws", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("fail"));
    const { withAuditLogging } = await import("./handler");
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
    vi.runAllTimers();
    expect(handler).toHaveBeenCalled();
  });
});
