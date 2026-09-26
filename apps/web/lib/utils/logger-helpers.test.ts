import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deepDiff, redactPII, sanitizeUrlForLogging } from "./logger-helpers";

// Patch cache before any imports
beforeEach(async () => {
  // Mock the cache service for tests
  vi.doMock("@/lib/cache", () => ({
    cache: {
      getRedisClient: vi.fn().mockResolvedValue({
        multi: vi.fn().mockReturnValue({
          set: vi.fn(),
          exec: vi.fn().mockResolvedValue([["OK"]]),
        }),
        watch: vi.fn().mockResolvedValue("OK"),
        get: vi.fn().mockResolvedValue(null),
      }),
    },
  }));
});

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsAuditLogsEnabled: vi.fn().mockResolvedValue(true),
}));

// Move all relevant mocks to the very top
vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
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

// Cache mock is handled in beforeEach above

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

/**
 * ENG-2873. Exact-key redaction cannot protect the inside of a response's `data`: its keys are the
 * customer's own element ids, so no list of names reaches the answers. These pin the deny-by-default
 * projection that replaces such containers with their shape.
 */
describe("redactPII — content containers", () => {
  test("reduces a response's data, variables and embedded data to field names and a count", () => {
    const input = {
      id: "r1",
      data: { q1: "my landlord is Jane Doe", q2: 4 },
      variables: { score: 8 },
      embeddedData: { plan: "pro" },
    };

    const redacted = redactPII(input);

    expect(redacted).toEqual({
      id: "r1",
      data: { redactedContent: true, fieldNames: ["q1", "q2"], fieldCount: 2 },
      variables: { redactedContent: true, fieldNames: ["score"], fieldCount: 1 },
      embeddedData: { redactedContent: true, fieldNames: ["plan"], fieldCount: 1 },
    });
    expect(JSON.stringify(redacted)).not.toContain("Jane Doe");
  });

  test("reduces a contact attribute snapshot and a metadata blob the same way", () => {
    const redacted = redactPII({
      contactAttributes: { company: "Acme", plan: "team" },
      metadata: { source: "app-store", rating: 1 },
    });

    expect(redacted.contactAttributes).toEqual({
      redactedContent: true,
      fieldNames: ["company", "plan"],
      fieldCount: 2,
    });
    expect(redacted.metadata).toEqual({
      redactedContent: true,
      fieldNames: ["rating", "source"],
      fieldCount: 2,
    });
  });

  test("leaves an array under a container name to the normal walk — survey variables are definitions", () => {
    const redacted = redactPII({ variables: [{ id: "v1", type: "number", value: 0 }] });

    expect(redacted.variables).toEqual([{ id: "v1", type: "number", value: 0 }]);
  });

  test("reports which fields a patch changed, not what they became", () => {
    const before = { finished: false, data: { q1: "old", q2: "same" } };
    const after = { finished: true, data: { q1: "new", q2: "same" } };

    expect(redactPII(deepDiff(before, after))).toEqual({
      finished: true,
      data: { redactedContent: true, fieldNames: ["q1"], fieldCount: 1 },
    });
  });

  test("redacts the respondent identifiers and free-text leaves regardless of casing", () => {
    const redacted = redactPII({
      meta: { ipAddress: "203.0.113.9", userAgent: { browser: "Firefox" }, url: "https://example.com/s" },
      value_text: "the checkout page keeps failing",
      translated_text: "die Kasse schlägt fehl",
    });

    expect(redacted.meta).toEqual({
      ipAddress: "********",
      userAgent: "********",
      url: "https://example.com/s",
    });
    expect(redacted.value_text).toBe("********");
    expect(redacted.translated_text).toBe("********");
  });

  test("matches the two camelCase entries that were listed in the wrong case", () => {
    expect(redactPII({ stripeCustomerId: "cus_123", fileName: "passport.pdf" })).toEqual({
      stripeCustomerId: "********",
      fileName: "********",
    });
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
    const { withAuditLogging } = await import("../../modules/ee/audit-logs/lib/handler");
    const wrapped = withAuditLogging("created", "survey", handler);
    const ctx = {
      user: {
        id: "u1",
        name: "Test User",
        email: "test@example.com",
        emailVerified: false,
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
    const { withAuditLogging } = await import("../../modules/ee/audit-logs/lib/handler");
    const wrapped = withAuditLogging("created", "survey", handler);
    const ctx = {
      user: {
        id: "u1",
        name: "Test User",
        email: "test@example.com",
        emailVerified: false,
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

describe("sanitizeUrlForLogging", () => {
  test("returns sanitized URL with token", () => {
    expect(sanitizeUrlForLogging("https://example.com?token=1234567890")).toBe(
      "https://example.com/?token=********"
    );
  });

  test("returns sanitized URL with code", () => {
    expect(sanitizeUrlForLogging("https://example.com?code=1234567890")).toBe(
      "https://example.com/?code=********"
    );
  });

  test("returns sanitized URL with state", () => {
    expect(sanitizeUrlForLogging("https://example.com?state=1234567890")).toBe(
      "https://example.com/?state=********"
    );
  });

  test("returns sanitized URL with multiple keys", () => {
    expect(
      sanitizeUrlForLogging("https://example.com?token=1234567890&code=1234567890&state=1234567890")
    ).toBe("https://example.com/?token=********&code=********&state=********");
  });

  test("returns sanitized URL without query params", () => {
    expect(sanitizeUrlForLogging("https://example.com")).toBe("https://example.com/");
  });

  test("returns sanitized URL with invalid URL", () => {
    expect(sanitizeUrlForLogging("not-a-valid-url")).toBe("[invalid-url]");
  });
});
