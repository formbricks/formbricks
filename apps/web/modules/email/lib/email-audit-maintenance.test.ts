import { beforeEach, describe, expect, test, vi } from "vitest";
import type { JobExecutionContext } from "@formbricks/jobs";
import {
  processEmailAuditMaintenanceJob,
  requestEmailAuditErasure,
  requestEmailAuditErasureBeforeUserDeletion,
  requestEmailAuditErasureBestEffort,
} from "./email-audit-maintenance";

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

  test("does not silently skip email-only erasure when the HMAC service fails", async () => {
    mocks.getMac.mockRejectedValueOnce(new Error("kms unavailable"));

    await expect(requestEmailAuditErasure({ email: "Person@Example.com" })).rejects.toThrow("recipient_hmac");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  test("stops before marking rows if recipient matching fails during user deletion", async () => {
    mocks.getMac.mockRejectedValueOnce(new Error("kms unavailable"));

    await expect(requestEmailAuditErasure({ userId: "user-1", email: "Person@Example.com" })).rejects.toThrow(
      "recipient_hmac"
    );

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  test("reports an erasure gap when an identifier-based request fails", async () => {
    mocks.updateMany.mockRejectedValueOnce(new Error("database unavailable"));

    await requestEmailAuditErasureBestEffort({ organizationId: "org-1" });

    expect(mocks.reportFailure).toHaveBeenCalledWith("email_audit_erasure_request_failed", {
      phase: undefined,
    });
  });

  test("blocks user deletion while recipient erasure cannot be queued", async () => {
    mocks.getMac.mockRejectedValueOnce(new Error("kms unavailable"));

    await expect(requestEmailAuditErasureBeforeUserDeletion("user-1", "Person@Example.com")).rejects.toThrow(
      "Email audit erasure could not be prepared"
    );
    expect(mocks.reportFailure).toHaveBeenCalledWith("email_audit_erasure_request_failed", {
      phase: "recipient_hmac",
    });
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
    const before = Date.now();
    mocks.findMany
      .mockResolvedValueOnce([{ id: "stale-id" }])
      .mockResolvedValueOnce([
        { id: "erased-id", snapshotKey: "email-audit/erased-id.json", erasureRequestedAt: new Date() },
      ])
      .mockResolvedValueOnce([{ id: "expired-id" }]);

    await processEmailAuditMaintenanceJob({ scope: "global" }, jobContext);

    const erasureCutoff = mocks.findMany.mock.calls[1][0].where.OR[0].erasureRequestedAt.lte as Date;
    expect(erasureCutoff.getTime()).toBeGreaterThanOrEqual(before - 60_000);
    expect(erasureCutoff.getTime()).toBeLessThanOrEqual(Date.now() - 60_000);

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
