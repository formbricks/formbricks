import { APIError } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { deleteUserOrganizationRelationships } from "@/lib/authzed/organization-membership";
import { deleteUserTeamRelationships } from "@/lib/authzed/team-workspace";
import { deleteOrganization, getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { deleteBrevoCustomerByEmail } from "@/modules/auth/lib/brevo";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { sendAccountDeletedEmail } from "@/modules/email";
import {
  activateEmailAuditErasureIntent,
  requestEmailAuditErasureBeforeUserDeletion,
} from "@/modules/email/lib/email-audit-maintenance";
import { queueAccountDeletionAuditEvent } from "./account-deletion-audit";
import {
  accountDeletionAfterDelete,
  accountDeletionBeforeDelete,
  accountDeletionConfig,
  requireDeletionConfirmationBeforeHandler,
} from "./better-auth-account-deletion";

vi.mock("@formbricks/database", () => ({ prisma: { invite: { deleteMany: vi.fn() } } }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/authzed/organization-membership", () => ({
  deleteUserOrganizationRelationships: vi.fn(),
}));
vi.mock("@/lib/authzed/team-workspace", () => ({
  deleteUserTeamRelationships: vi.fn(),
}));
vi.mock("@/lib/organization/service", () => ({
  deleteOrganization: vi.fn(),
  getOrganizationsWhereUserIsSingleOwner: vi.fn(),
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/auth/lib/brevo", () => ({ deleteBrevoCustomerByEmail: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsMultiOrgEnabled: vi.fn() }));
vi.mock("@/modules/email/lib/email-audit-maintenance", () => ({
  activateEmailAuditErasureIntent: vi.fn(),
  requestEmailAuditErasureBeforeUserDeletion: vi.fn(),
}));
vi.mock("@/modules/email", () => ({ sendAccountDeletedEmail: vi.fn() }));
vi.mock("./account-deletion-audit", () => ({ queueAccountDeletionAuditEvent: vi.fn() }));

const user = { id: "user-1", email: "ada@example.com", name: "Ada" } as Parameters<
  typeof accountDeletionBeforeDelete
>[0];

describe("accountDeletionBeforeDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(prisma.invite.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(deleteOrganization).mockResolvedValue(true as never);
    vi.mocked(requestEmailAuditErasureBeforeUserDeletion).mockResolvedValue(undefined);
  });

  test("blocks deletion on a single-org instance when the user is a sole org owner", async () => {
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([{ id: "org-1" }] as never);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);

    await expect(accountDeletionBeforeDelete(user)).rejects.toBeInstanceOf(APIError);
    // records the blocked attempt as a failure-path audit before surfacing the error
    expect(queueAccountDeletionAuditEvent).toHaveBeenCalledWith({
      status: "failure",
      targetUserId: "user-1",
      oldUser: expect.objectContaining({ id: "user-1" }),
    });
    // throws before any destructive cleanup
    expect(deleteOrganization).not.toHaveBeenCalled();
    expect(prisma.invite.deleteMany).not.toHaveBeenCalled();
    expect(requestEmailAuditErasureBeforeUserDeletion).not.toHaveBeenCalled();
    // a blocked deletion never reaches afterDelete, so nothing is mailed
    await vi.runAllTimersAsync();
    expect(sendAccountDeletedEmail).not.toHaveBeenCalled();
  });

  test("multi-org: deletes every sole-owner org and the creator's invites, no block", async () => {
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([
      { id: "org-1" },
      { id: "org-2" },
    ] as never);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);

    await expect(accountDeletionBeforeDelete(user)).resolves.toBeUndefined();

    expect(deleteOrganization).toHaveBeenCalledTimes(2);
    expect(deleteOrganization).toHaveBeenCalledWith("org-1");
    expect(deleteOrganization).toHaveBeenCalledWith("org-2");
    expect(prisma.invite.deleteMany).toHaveBeenCalledWith({ where: { creatorId: "user-1" } });
    expect(requestEmailAuditErasureBeforeUserDeletion).toHaveBeenCalledWith("user-1", "ada@example.com");
    expect(vi.mocked(requestEmailAuditErasureBeforeUserDeletion).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deleteOrganization).mock.invocationCallOrder[0]
    );
  });

  test("no sole-owner orgs: skips the license check and deletes only the creator's invites", async () => {
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([] as never);

    await expect(accountDeletionBeforeDelete(user)).resolves.toBeUndefined();

    expect(getIsMultiOrgEnabled).not.toHaveBeenCalled();
    expect(deleteOrganization).not.toHaveBeenCalled();
    expect(prisma.invite.deleteMany).toHaveBeenCalledWith({ where: { creatorId: "user-1" } });
  });

  test("stops account deletion before cleanup when audit erasure cannot be prepared", async () => {
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([] as never);
    vi.mocked(requestEmailAuditErasureBeforeUserDeletion).mockRejectedValueOnce(
      new Error("audit unavailable")
    );

    await expect(accountDeletionBeforeDelete(user)).rejects.toThrow("audit unavailable");

    expect(prisma.invite.deleteMany).not.toHaveBeenCalled();
    expect(deleteOrganization).not.toHaveBeenCalled();
  });
});

describe("accountDeletionAfterDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(deleteBrevoCustomerByEmail).mockResolvedValue(undefined as never);
    vi.mocked(queueAccountDeletionAuditEvent).mockResolvedValue(undefined as never);
    vi.mocked(sendAccountDeletedEmail).mockResolvedValue(true);
  });

  test("schedules one account-deleted email to the deleted user's address without awaiting it", async () => {
    await accountDeletionAfterDelete(user);

    // queued, not sent inside the deletion request path
    expect(sendAccountDeletedEmail).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(sendAccountDeletedEmail).toHaveBeenCalledOnce();
    expect(sendAccountDeletedEmail).toHaveBeenCalledWith({ email: "ada@example.com", locale: "en-US" });
    expect(vi.mocked(activateEmailAuditErasureIntent).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(sendAccountDeletedEmail).mock.invocationCallOrder[0]
    );
  });

  test("does not wait for a slow mailer before resolving", async () => {
    vi.mocked(sendAccountDeletedEmail).mockReturnValue(new Promise(() => {}));

    await expect(accountDeletionAfterDelete(user)).resolves.toBeUndefined();
    await vi.runAllTimersAsync();

    expect(sendAccountDeletedEmail).toHaveBeenCalledOnce();
  });

  test("logs and swallows a thrown email failure", async () => {
    vi.mocked(sendAccountDeletedEmail).mockRejectedValue(new Error("smtp down"));

    await expect(accountDeletionAfterDelete(user)).resolves.toBeUndefined();
    await vi.runAllTimersAsync();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      "Failed to send account deletion email"
    );
  });

  test("logs an email the mailer reports as not sent", async () => {
    vi.mocked(sendAccountDeletedEmail).mockResolvedValue(false);

    await expect(accountDeletionAfterDelete(user)).resolves.toBeUndefined();
    await vi.runAllTimersAsync();

    expect(logger.warn).toHaveBeenCalledWith(
      { userId: "user-1" },
      "Account deletion email was not sent (mailer reported no delivery)"
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("deletes the Brevo customer and queues a success audit event with the deleted user", async () => {
    await accountDeletionAfterDelete(user);

    expect(activateEmailAuditErasureIntent).toHaveBeenCalledWith("user-1");
    expect(deleteUserOrganizationRelationships).toHaveBeenCalledWith("user-1");
    expect(deleteUserTeamRelationships).toHaveBeenCalledWith("user-1");
    expect(deleteBrevoCustomerByEmail).toHaveBeenCalledWith({ email: "ada@example.com" });
    expect(queueAccountDeletionAuditEvent).toHaveBeenCalledWith({
      oldUser: user,
      status: "success",
      targetUserId: "user-1",
    });
    expect(capturePostHogEvent).toHaveBeenCalledWith("user-1", "delete_account");
  });

  test("logs and swallows a Brevo failure, then still emits the audit event", async () => {
    vi.mocked(deleteBrevoCustomerByEmail).mockRejectedValue(new Error("brevo unreachable"));

    await expect(accountDeletionAfterDelete(user)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
    expect(queueAccountDeletionAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", targetUserId: "user-1" })
    );
  });

  test("continues post-delete cleanup when the AuthZed cleanup unexpectedly rejects", async () => {
    vi.mocked(deleteUserOrganizationRelationships).mockRejectedValue(new Error("sensitive raw error"));

    await expect(accountDeletionAfterDelete(user)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      {
        component: "authzed",
        errorCode: "authzed_internal",
        errorName: "Error",
        operation: "account_delete_organization_cleanup",
        retryable: false,
        status: "failed",
      },
      "Unexpected AuthZed projection failure after source commit"
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("sensitive raw error");
    expect(deleteBrevoCustomerByEmail).toHaveBeenCalledWith({ email: "ada@example.com" });
    expect(queueAccountDeletionAuditEvent).toHaveBeenCalledWith({
      oldUser: user,
      status: "success",
      targetUserId: "user-1",
    });
    expect(capturePostHogEvent).toHaveBeenCalledWith("user-1", "delete_account");
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("accountDeletionConfig", () => {
  test("is enabled, wires both hooks, and sets no global delete-verification email", () => {
    expect(accountDeletionConfig.enabled).toBe(true);
    expect(accountDeletionConfig.beforeDelete).toBe(accountDeletionBeforeDelete);
    expect(accountDeletionConfig.afterDelete).toBe(accountDeletionAfterDelete);
    expect("sendDeleteAccountVerification" in accountDeletionConfig).toBe(false);
  });
});

const makeDeleteCtx = (overrides: {
  path?: string;
  body?: unknown;
}): Parameters<typeof requireDeletionConfirmationBeforeHandler>[0] =>
  ({ path: overrides.path ?? "/delete-user", body: overrides.body }) as unknown as Parameters<
    typeof requireDeletionConfirmationBeforeHandler
  >[0];

describe("requireDeletionConfirmationBeforeHandler (delete-user freshAge guard)", () => {
  test("allows the request when a password is supplied", async () => {
    await expect(
      requireDeletionConfirmationBeforeHandler(makeDeleteCtx({ body: { password: "pw" } }))
    ).resolves.toBeUndefined();
  });

  test("allows the request when a deletion token is supplied", async () => {
    await expect(
      requireDeletionConfirmationBeforeHandler(makeDeleteCtx({ body: { token: "tok" } }))
    ).resolves.toBeUndefined();
  });

  test("blocks a confirmation-less delete (closes the freshAge password bypass)", async () => {
    await expect(requireDeletionConfirmationBeforeHandler(makeDeleteCtx({ body: {} }))).rejects.toThrow(
      "Password confirmation is required"
    );
  });

  test("blocks when the request has no body", async () => {
    await expect(
      requireDeletionConfirmationBeforeHandler(makeDeleteCtx({ body: undefined }))
    ).rejects.toThrow("Password confirmation is required");
  });

  test("exempts the SSO email-link callback (/delete-user/callback)", async () => {
    // SSO deletion completes via the emailed GET callback (carrying its own token), not a password —
    // the guard must let it through, or the SSO email-link flow breaks.
    await expect(
      requireDeletionConfirmationBeforeHandler(makeDeleteCtx({ path: "/delete-user/callback", body: {} }))
    ).resolves.toBeUndefined();
  });

  test("ignores non-delete-user paths", async () => {
    await expect(
      requireDeletionConfirmationBeforeHandler(makeDeleteCtx({ path: "/sign-out", body: {} }))
    ).resolves.toBeUndefined();
  });
});
