import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { beginEmailSendAudit, finishEmailSendAudit, sesMessageHashFromSendInfo } from "./email-send-audit";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  getMac: vi.fn(),
  putSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  reportFailure: vi.fn(),
  audit: vi.fn(),
  constants: {
    EMAIL_SEND_AUDIT_ENABLED: true,
    EMAIL_SEND_AUDIT_BUCKET: "private-test-bucket",
    EMAIL_SEND_AUDIT_KMS_KEY_ARN: "test-kms-key",
    EMAIL_SEND_AUDIT_HMAC_KEY_ARN: "test-hmac-key",
    SES_EMAIL_ENVIRONMENT: "staging",
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    outboundEmailAudit: { create: mocks.create, update: mocks.update, updateMany: mocks.updateMany },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { audit: mocks.audit } }));
vi.mock("@/lib/constants", () => mocks.constants);
vi.mock("./email-audit-storage", () => ({
  emailAuditObjectKey: (id: string) => `email-audit/${id}.json`,
  getEmailAuditRecipientMac: mocks.getMac,
  putEmailAuditSnapshot: mocks.putSnapshot,
  deleteEmailAuditSnapshot: mocks.deleteSnapshot,
}));
vi.mock("./email-audit-monitoring", () => ({ reportEmailAuditFailure: mocks.reportFailure }));

const context = { trigger: "response" as const, organizationId: "org-1", surveyId: "survey-1" };
const snapshot = { subject: "Private subject", html: "<p>Private content</p>", text: "Private text" };

describe("outbound email audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMac.mockResolvedValue("stable-recipient-mac");
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.putSnapshot.mockResolvedValue({ key: "email-audit/test.json", sha256: "digest" });
    mocks.deleteSnapshot.mockResolvedValue(undefined);
    mocks.reportFailure.mockResolvedValue(undefined);
  });

  test("records only safe metadata and the exact rendered copy before SMTP", async () => {
    const before = Date.now();
    const state = await beginEmailSendAudit(
      "response_notification",
      " Person@Example.com ",
      snapshot,
      context
    );
    expect(state).toMatchObject({ rowCreated: true, auditGap: false });
    expect(mocks.getMac).toHaveBeenCalledWith(" Person@Example.com ", "test-hmac-key");
    expect(mocks.putSnapshot).toHaveBeenCalledWith(
      "private-test-bucket",
      "test-kms-key",
      state?.id,
      snapshot
    );
    const row = mocks.create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      emailType: "response_notification",
      trigger: "response",
      actorKind: "system",
      organizationId: "org-1",
      surveyId: "survey-1",
      recipientMac: "stable-recipient-mac",
      snapshotKey: `email-audit/${state?.id}.json`,
    });
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.putSnapshot.mock.invocationCallOrder[0]
    );
    expect(row.contentExpiresAt.getTime() - before).toBeGreaterThanOrEqual(30 * 86_400_000);
    expect(row.expiresAt.getTime() - before).toBeGreaterThanOrEqual(90 * 86_400_000);
    expect(JSON.stringify(mocks.create.mock.calls)).not.toContain("Person@Example.com");
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("Private");

    await finishEmailSendAudit(state, "response_notification", context, "accepted", {
      serverMessageId: "ses-123",
      messageId: "rfc-456",
    });
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: { id: state?.id, erasedAt: null, erasureRequestedAt: null },
      data: {
        status: "accepted",
        statusRecordedAt: expect.any(Date),
        sesMessageHash: createHash("sha256").update("ses-123").digest("hex"),
      },
    });
    expect(mocks.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "accepted",
        sesMessageHash: createHash("sha256").update("ses-123").digest("hex"),
      }),
      "Outbound email audit"
    );
  });

  test("continues with an explicit gap and no content copy when the ledger fails", async () => {
    mocks.create.mockRejectedValueOnce(new Error("database unavailable"));
    const state = await beginEmailSendAudit("invite", "person@example.com", snapshot, context);
    expect(state).toMatchObject({ rowCreated: false, auditGap: true });
    expect(mocks.putSnapshot).not.toHaveBeenCalled();
    expect(mocks.reportFailure).toHaveBeenCalledWith("email_audit_gap", {
      auditId: state?.id,
      phase: "ledger_create",
    });
  });

  test("does not retain email content when the recipient identifier is unavailable", async () => {
    mocks.getMac.mockRejectedValueOnce(new Error("KMS unavailable"));

    const state = await beginEmailSendAudit("password_reset", "person@example.com", snapshot, context);

    expect(state).toMatchObject({ rowCreated: true, auditGap: true });
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      recipientMac: undefined,
      snapshotKey: null,
      auditGap: true,
    });
    expect(mocks.putSnapshot).not.toHaveBeenCalled();
    expect(mocks.reportFailure).toHaveBeenCalledWith("email_audit_gap", {
      auditId: state?.id,
      phase: "recipient_hmac",
    });
  });

  test("continues with an explicit gap when the content store fails", async () => {
    mocks.putSnapshot.mockRejectedValueOnce(new Error("object store unavailable"));
    const state = await beginEmailSendAudit("invite", "person@example.com", snapshot, context);
    expect(state).toMatchObject({ rowCreated: true, auditGap: true });
    expect(mocks.create.mock.calls[0][0].data.snapshotKey).toBe(`email-audit/${state?.id}.json`);
    expect(mocks.deleteSnapshot).toHaveBeenCalledWith("private-test-bucket", state?.id);
    expect(mocks.reportFailure).toHaveBeenCalledWith("email_audit_gap", {
      auditId: state?.id,
      phase: "snapshot_write",
    });
  });

  test("deletes a snapshot whose ledger was erased while S3 was writing", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    const state = await beginEmailSendAudit("invite", "person@example.com", snapshot, context);
    expect(mocks.deleteSnapshot).toHaveBeenCalledWith("private-test-bucket", state?.id);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: state?.id, erasedAt: null },
      data: { snapshotSha256: "digest" },
    });
  });

  test("deletes an unindexed snapshot when linking it to the ledger fails", async () => {
    mocks.updateMany.mockRejectedValueOnce(new Error("ledger unavailable"));
    const state = await beginEmailSendAudit("invite", "person@example.com", snapshot, context);
    expect(mocks.deleteSnapshot).toHaveBeenCalledWith("private-test-bucket", state?.id);
    expect(mocks.reportFailure).toHaveBeenCalledWith("email_audit_gap", {
      auditId: state?.id,
      phase: "snapshot_write",
    });
  });

  test("never confuses RFC Message-ID with the SES-assigned identifier", () => {
    expect(sesMessageHashFromSendInfo({ messageId: "rfc-only" })).toBeUndefined();
    expect(sesMessageHashFromSendInfo({ response: "250 Ok ses-789", messageId: "rfc-only" })).toBe(
      createHash("sha256").update("ses-789").digest("hex")
    );
  });
});
