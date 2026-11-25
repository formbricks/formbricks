import { beforeEach, describe, expect, test, vi } from "vitest";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { queueV3AuditLog, skipV3AuditLog } from "./audit";

vi.mock("server-only", () => ({}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));

const requestId = "req_1";
const logError = vi.fn();
const log = { error: logError } as unknown as Parameters<typeof queueV3AuditLog>[2];

const auditLog = () => ({
  action: "archived" as const,
  targetType: "survey" as const,
  targetId: "survey_1",
  organizationId: "org_1",
  userId: "user_1",
  userType: "user" as const,
  status: "success" as const,
});

beforeEach(() => {
  logError.mockReset();
  vi.mocked(queueAuditEvent).mockReset();
  vi.mocked(queueAuditEvent).mockResolvedValue(undefined);
});

describe("queueV3AuditLog", () => {
  test("queues a log that was not skipped", async () => {
    const entry = auditLog();

    await queueV3AuditLog(entry, requestId, log);

    expect(queueAuditEvent).toHaveBeenCalledExactlyOnceWith(entry);
  });

  test("does not queue a skipped log", async () => {
    const entry = auditLog();

    skipV3AuditLog(entry);
    await queueV3AuditLog(entry, requestId, log);

    expect(queueAuditEvent).not.toHaveBeenCalled();
  });

  test("does nothing without a log", async () => {
    await queueV3AuditLog(undefined, requestId, log);

    expect(queueAuditEvent).not.toHaveBeenCalled();
  });

  test("gives a failure entry the request id as its event id, so a retry cannot duplicate it", async () => {
    const entry = { ...auditLog(), status: "failure" as const };

    await queueV3AuditLog(entry, requestId, log);

    expect(queueAuditEvent).toHaveBeenCalledExactlyOnceWith({ ...entry, eventId: requestId });
  });

  test("keeps an event id already on the entry", async () => {
    const entry = { ...auditLog(), status: "failure" as const, eventId: "evt_1" };

    await queueV3AuditLog(entry, requestId, log);

    expect(queueAuditEvent).toHaveBeenCalledExactlyOnceWith(entry);
  });

  test("swallows a queue failure and logs it", async () => {
    const error = new Error("queue down");
    vi.mocked(queueAuditEvent).mockRejectedValue(error);

    await expect(queueV3AuditLog(auditLog(), requestId, log)).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith({ error }, "Failed to queue V3 audit event");
  });
});
