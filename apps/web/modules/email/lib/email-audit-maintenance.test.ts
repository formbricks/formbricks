import { beforeEach, describe, expect, test, vi } from "vitest";
import type { JobExecutionContext } from "@formbricks/jobs";
import { processEmailAuditMaintenanceJob, requestEmailAuditErasure } from "./email-audit-maintenance";

const jobContext: JobExecutionContext = {
  attempt: 1,
  jobId: "email-audit-maintenance-test",
  jobName: "email-audit.maintain",
  maxAttempts: 3,
  queueName: "background-jobs",
};

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  deleteSnapshot: vi.fn(),
  getMac: vi.fn(),
  reportFailure: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    outboundEmailAudit: {
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
      update: mocks.update,
      deleteMany: mocks.deleteMany,
    },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: mocks.warn } }));
vi.mock("@/lib/constants", () => ({
  EMAIL_SEND_AUDIT_BUCKET: "private-audit-bucket",
  EMAIL_SEND_AUDIT_HMAC_KEY_ARN: "hmac-key",
}));
vi.mock("./email-audit-storage", () => ({
  deleteEmailAuditSnapshot: mocks.deleteSnapshot,
  getEmailAuditRecipientMac: mocks.getMac,
}));
vi.mock("./email-audit-monitoring", () => ({ reportEmailAuditFailure: mocks.reportFailure }));

describe("email audit retention and erasure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.update.mockResolvedValue({});
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.deleteSnapshot.mockResolvedValue(undefined);
    mocks.getMac.mockResolvedValue("recipient-mac");
    mocks.reportFailure.mockResolvedValue(undefined);
  });

  test("requests erasure by normalized recipient identity without storing an address", async () => {
    await requestEmailAuditErasure({ email: "Person@Example.com" });
    expect(mocks.getMac).toHaveBeenCalledWith("Person@Example.com", "hmac-key");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ recipientMac: "recipient-mac" }], erasedAt: null },
      data: { erasureRequestedAt: expect.any(Date) },
    });
    expect(JSON.stringify(mocks.updateMany.mock.calls)).not.toContain("Person@Example.com");
  });

  test("requests erasure for bulk-deleted responses in bounded batches", async () => {
    const responseIds = Array.from({ length: 501 }, (_, index) => `response-${index}`);

    await requestEmailAuditErasure({ responseIds });

    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, {
      where: { responseId: { in: responseIds.slice(0, 500) }, erasedAt: null },
      data: { erasureRequestedAt: expect.any(Date) },
    });
    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
      where: { responseId: { in: responseIds.slice(500) }, erasedAt: null },
      data: { erasureRequestedAt: expect.any(Date) },
    });
  });

  test("marks interrupted attempts indeterminate and removes erased content and identifiers", async () => {
    mocks.findMany
      .mockResolvedValueOnce([{ id: "stale-id" }])
      .mockResolvedValueOnce([
        { id: "erased-id", snapshotKey: "email-audit/erased-id.json", erasureRequestedAt: new Date() },
      ])
      .mockResolvedValueOnce([{ id: "expired-id" }]);

    await processEmailAuditMaintenanceJob({ scope: "global" }, jobContext);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["stale-id"] }, status: "prepared" },
      data: { status: "indeterminate", statusRecordedAt: expect.any(Date), auditGap: true },
    });
    expect(mocks.deleteSnapshot).toHaveBeenCalledWith("private-audit-bucket", "erased-id");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "erased-id",
        snapshotKey: "email-audit/erased-id.json",
        erasureRequestedAt: { not: null },
        erasedAt: null,
      },
      data: expect.objectContaining({
        snapshotKey: null,
        recipientMac: null,
        organizationId: null,
        actorUserId: null,
        status: "erased",
        erasedAt: expect.any(Date),
      }),
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["expired-id"] } } });
    expect(mocks.reportFailure).toHaveBeenCalledWith("email_audit_stale_prepared", { count: 1 });
  });

  test("keeps an erasure request pending when S3 deletion fails", async () => {
    mocks.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "erased-id", snapshotKey: "email-audit/erased-id.json", erasureRequestedAt: new Date() },
      ])
      .mockResolvedValueOnce([]);
    mocks.deleteSnapshot.mockRejectedValueOnce(new Error("S3 unavailable"));

    await processEmailAuditMaintenanceJob({ scope: "global" }, jobContext);

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.reportFailure).toHaveBeenCalledWith("email_audit_content_delete_failed", {
      auditId: "erased-id",
    });
  });
});
