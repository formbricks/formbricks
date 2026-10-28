import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { UNKNOWN_DATA } from "../types/audit-log";
import { MAX_PERSISTED_CHANGES_BYTES, logAuditEvent } from "./service";

// Mocks
globalThis.console = { ...globalThis.console, error: vi.fn() };

vi.mock("../../../ee/license-check/lib/utils", () => ({
  getIsAuditLogsEnabled: vi.fn(),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { audit: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@formbricks/database", () => ({
  prisma: { auditEvent: { create: vi.fn() } },
}));

const validEvent = {
  actor: { id: "user-1", type: "user" as const },
  action: "created" as const,
  target: { id: "target-1", type: "user" as const },
  status: "success" as const,
  timestamp: new Date().toISOString(),
  organizationId: "org-1",
  ipAddress: "203.0.113.7",
  userAgent: "test-agent",
};

describe("logAuditEvent", () => {
  let getIsAuditLogsEnabled: any;
  let logger: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    getIsAuditLogsEnabled = (await import("@/modules/ee/license-check/lib/utils")).getIsAuditLogsEnabled;
    logger = (await import("@formbricks/logger")).logger;
  });

  test("derives scalar actor and target search fields from the event", async () => {
    await logAuditEvent(validEvent);
    expect(logger.audit).toHaveBeenCalledWith({
      ...validEvent,
      actorId: "user-1",
      actorType: "user",
      targetId: "target-1",
      targetType: "user",
    });
  });

  test("logs event if access is granted and event is valid", async () => {
    getIsAuditLogsEnabled.mockResolvedValue(true);
    await logAuditEvent(validEvent);
    expect(logger.audit).toHaveBeenCalledWith(expect.objectContaining(validEvent));
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("throws and logs error for invalid event", async () => {
    getIsAuditLogsEnabled.mockResolvedValue(true);
    const invalidEvent = { ...validEvent, action: "invalid.action" };
    await logAuditEvent(invalidEvent as any);
    expect(logger.audit).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  test("handles UNKNOWN_DATA organizationId", async () => {
    getIsAuditLogsEnabled.mockResolvedValue(true);
    const event = { ...validEvent, organizationId: UNKNOWN_DATA };
    await logAuditEvent(event);
    expect(logger.audit).toHaveBeenCalledWith(expect.objectContaining(event));
  });

  test("does not throw if logger.audit throws", async () => {
    getIsAuditLogsEnabled.mockResolvedValue(true);
    logger.audit.mockImplementation(() => {
      throw new Error("fail");
    });
    await logAuditEvent(validEvent);
    expect(logger.error).toHaveBeenCalled();
  });

  // `apiUrl` is validated with z.url(), and a validation failure is swallowed into a logger.error
  // rather than surfaced — so a producer passing a malformed value silently drops the whole audit
  // event. That is exactly how every MCP mutation went unaudited (ENG-2173).
  describe("apiUrl", () => {
    beforeEach(() => {
      getIsAuditLogsEnabled.mockResolvedValue(true);
    });

    test("drops the event when apiUrl is a bare path", async () => {
      await logAuditEvent({ ...validEvent, apiUrl: "/api/mcp" } as any);
      expect(logger.audit).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    test("logs the event when apiUrl is absolute", async () => {
      const event = { ...validEvent, apiUrl: "http://localhost:3000/api/mcp" };
      await logAuditEvent(event);
      expect(logger.audit).toHaveBeenCalledWith(expect.objectContaining(event));
      expect(logger.error).not.toHaveBeenCalled();
    });

    test("logs the event when apiUrl is omitted (optional, unlike a malformed one)", async () => {
      await logAuditEvent(validEvent);
      expect(logger.audit).toHaveBeenCalledWith(expect.objectContaining(validEvent));
      expect(logger.error).not.toHaveBeenCalled();
    });

    // Ties the MCP producer to this schema: the exact value the MCP tools pass must be one this
    // validator accepts, which is the invariant that broke.
    test("accepts the apiUrl the MCP tools actually pass", async () => {
      const { getMcpResourceUrl } = await import("@/modules/auth/lib/oauth-urls");
      await logAuditEvent({ ...validEvent, apiUrl: getMcpResourceUrl() });
      expect(logger.audit).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});

describe("logAuditEvent export", () => {
  test("is a function and works as expected", async () => {
    expect(typeof logAuditEvent).toBe("function");
    // Just check it calls the underlying logic and does not throw
    await expect(logAuditEvent(validEvent)).resolves.not.toThrow();
  });
});

describe("persisting audit events", () => {
  let logger: any;
  let createAuditEvent: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    logger = (await import("@formbricks/logger")).logger;
    createAuditEvent = (await import("@formbricks/database")).prisma.auditEvent.create as ReturnType<
      typeof vi.fn
    >;
    createAuditEvent.mockResolvedValue({});
  });

  test("stores the validated event, mapped onto the table's columns", async () => {
    const event = {
      ...validEvent,
      target: { id: undefined, type: "survey" as const },
      status: "failure" as const,
      eventId: "req-1",
      apiUrl: "http://localhost:3000/api/mcp",
      changes: { name: "********" },
    };

    await logAuditEvent(event);

    expect(createAuditEvent).toHaveBeenCalledTimes(1);
    expect(createAuditEvent).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        timestamp: new Date(event.timestamp),
        actorId: "user-1",
        actorType: "user",
        action: "created",
        targetType: "survey",
        targetId: undefined,
        status: "failure",
        eventId: "req-1",
        apiUrl: "http://localhost:3000/api/mcp",
        ipAddress: "203.0.113.7",
        userAgent: "test-agent",
        changes: { name: "********" },
      },
    });
  });

  test("does not store an event that failed validation", async () => {
    await logAuditEvent({ ...validEvent, action: "invalid.action" } as any);
    expect(createAuditEvent).not.toHaveBeenCalled();
  });

  test("logs but does not store an event with an unknown organization", async () => {
    await logAuditEvent({ ...validEvent, organizationId: UNKNOWN_DATA });
    expect(logger.audit).toHaveBeenCalled();
    expect(createAuditEvent).not.toHaveBeenCalled();
  });

  test("a failed insert is logged as an error, never thrown, and the log record is already written", async () => {
    createAuditEvent.mockRejectedValue(new Error("connection lost"));

    await expect(logAuditEvent(validEvent)).resolves.toBeUndefined();

    expect(logger.audit).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ action: "created", targetType: "user", targetId: "target-1" }),
      "Failed to persist audit event"
    );
  });

  test("an error log never carries the event's changes, address or user agent", async () => {
    createAuditEvent.mockRejectedValue(new Error("connection lost"));

    await logAuditEvent({ ...validEvent, changes: { status: "inProgress" } });

    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).not.toContain("203.0.113.7");
    expect(logged).not.toContain("test-agent");
    expect(logged).not.toContain("inProgress");
  });

  test("a logger transport failure does not stop the event being stored", async () => {
    logger.audit.mockImplementation(() => {
      throw new Error("transport down");
    });

    await logAuditEvent(validEvent);

    expect(createAuditEvent).toHaveBeenCalledTimes(1);
  });

  test("an organization deleted before the write is a warning, not an error", async () => {
    createAuditEvent.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint violated", {
        code: "P2003",
        clientVersion: "test",
      })
    );

    await expect(logAuditEvent(validEvent)).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("replaces a diff over the size cap with a marker instead of storing it", async () => {
    const changes = { description: "x".repeat(MAX_PERSISTED_CHANGES_BYTES) };

    await logAuditEvent({ ...validEvent, changes });

    expect(createAuditEvent.mock.calls[0][0].data.changes).toEqual({ truncated: true });
  });

  test("a diff at the cap is stored whole", async () => {
    const changes = { description: "x".repeat(100) };

    await logAuditEvent({ ...validEvent, changes });

    expect(createAuditEvent.mock.calls[0][0].data.changes).toEqual(changes);
  });
});

describe("what reaches the table when an entry point builds the event", () => {
  test("stores only redacted changes: no secrets, personal fields or respondent answers", async () => {
    vi.doMock("@/lib/constants", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/constants")>()),
      AUDIT_LOG_ENABLED: true,
      AUDIT_LOG_GET_USER_IP: false,
    }));
    const { getIsAuditLogsEnabled } = await import("@/modules/ee/license-check/lib/utils");
    vi.mocked(getIsAuditLogsEnabled).mockResolvedValue(true);
    const createAuditEvent = (await import("@formbricks/database")).prisma.auditEvent.create as ReturnType<
      typeof vi.fn
    >;
    createAuditEvent.mockResolvedValue({});
    const { queueAuditEventWithoutRequest } = await import("./handler");

    await queueAuditEventWithoutRequest({
      action: "updated",
      targetType: "response",
      userId: "user-1",
      userType: "user",
      targetId: "resp-1",
      organizationId: "org-1",
      status: "success",
      oldObject: { id: "resp-1", finished: false, data: { q1: "my private answer" } },
      newObject: {
        id: "resp-1",
        finished: true,
        email: "person@example.com",
        password: "hunter2",
        apiKey: "fbk_secret_value",
        token: "tok_secret",
        data: { q1: "my private answer", q2: "another private answer" },
        callback: "https://example.com/hook?token=tok_in_url&ok=1",
      },
    });

    expect(createAuditEvent).toHaveBeenCalledTimes(1);
    const stored = createAuditEvent.mock.calls[0][0].data;
    const serialized = JSON.stringify(stored);
    for (const secret of [
      "person@example.com",
      "hunter2",
      "fbk_secret_value",
      "tok_secret",
      "tok_in_url",
      "my private answer",
      "another private answer",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(stored.changes).toMatchObject({
      finished: true,
      email: "********",
      password: "********",
      data: { redactedContent: true, fieldNames: ["q2"] },
    });
    // The address is the sentinel when AUDIT_LOG_GET_USER_IP is off.
    expect(stored.ipAddress).toBe(UNKNOWN_DATA);
  });
});
