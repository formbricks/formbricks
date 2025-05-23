import { beforeEach, describe, expect, test, vi } from "vitest";
import { deepDiff, redactPII } from "./utils";

// Do NOT import buildAndLogAuditEvent, queueAuditEventBackground, or queueAuditEvent as named imports for spy to work

// Mocks
vi.mock("@/lib/constants", () => ({
  AUDIT_LOG_ENABLED: true,
  AUDIT_LOG_GET_USER_IP: true,
}));
vi.mock("@/lib/utils/client-ip", () => ({
  getClientIpFromHeaders: vi.fn().mockResolvedValue("127.0.0.1"),
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromEnvironmentId: vi.fn().mockResolvedValue("org-env-id"),
}));
vi.mock("@/modules/ee/audit-logs/lib/service", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
}));

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
  let logAuditEventMock: any;
  beforeEach(async () => {
    await vi.resetModules();
    utils = await import("./utils");
    logAuditEventMock = (await import("@/modules/ee/audit-logs/lib/service")).logAuditEvent;
    logAuditEventMock.mockClear();
  });
  test("calls logAuditEvent in the background", async () => {
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
    expect(logAuditEventMock).toHaveBeenCalled();
  });
});

describe("queueAuditEvent", () => {
  let utils: any;
  let logAuditEventMock: any;
  beforeEach(async () => {
    await vi.resetModules();
    utils = await import("./utils");
    logAuditEventMock = (await import("@/modules/ee/audit-logs/lib/service")).logAuditEvent;
    logAuditEventMock.mockClear();
  });
  test("calls logAuditEvent synchronously", async () => {
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
    expect(logAuditEventMock).toHaveBeenCalled();
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
    const ctx = { user: { id: "u1" }, organizationId: "org1", ipAddress: "127.0.0.1" };
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
    const ctx = { user: { id: "u1" }, organizationId: "org1", ipAddress: "127.0.0.1" };
    const parsedInput = {};
    await expect(wrapped({ ctx, parsedInput })).rejects.toThrow("fail");
    // Wait for setImmediate
    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalled();
  });
  test("sets organizationId to UNKNOWN_DATA and logs error if getOrganizationIdFromEnvironmentId throws", async () => {
    const handler = vi.fn().mockResolvedValue("ok");
    const { withAuditLogging } = await import("./utils");
    const wrapped = withAuditLogging("created", "survey", handler);
    const ctx = { user: { id: "u1" }, ipAddress: "127.0.0.1" };
    const parsedInput = { environmentId: "env1" };
    const helper = await import("@/lib/utils/helper");
    const loggerModule = await import("@formbricks/logger");
    (helper.getOrganizationIdFromEnvironmentId as any).mockRejectedValueOnce(new Error("fail to get orgId"));
    await wrapped({ ctx, parsedInput });
    // Wait for setImmediate
    await new Promise((r) => setTimeout(r, 10));
    expect(loggerModule.logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      expect.stringContaining("Failed to get organizationId from environmentId")
    );
  });
});
