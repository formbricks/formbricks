import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { deleteOrganization, getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { deleteBrevoCustomerByEmail } from "@/modules/auth/lib/brevo";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { queueAccountDeletionAuditEvent } from "./account-deletion-audit";
import {
  accountDeletionAfterDelete,
  accountDeletionBeforeDelete,
  accountDeletionConfig,
} from "./better-auth-account-deletion";

vi.mock("@formbricks/database", () => ({ prisma: { invite: { deleteMany: vi.fn() } } }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/organization/service", () => ({
  deleteOrganization: vi.fn(),
  getOrganizationsWhereUserIsSingleOwner: vi.fn(),
}));
vi.mock("@/modules/auth/lib/brevo", () => ({ deleteBrevoCustomerByEmail: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsMultiOrgEnabled: vi.fn() }));
vi.mock("./account-deletion-audit", () => ({ queueAccountDeletionAuditEvent: vi.fn() }));

const user = { id: "user-1", email: "ada@example.com", name: "Ada" } as Parameters<
  typeof accountDeletionBeforeDelete
>[0];

describe("accountDeletionBeforeDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.invite.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(deleteOrganization).mockResolvedValue(true as never);
  });

  test("blocks deletion on a single-org instance when the user is a sole org owner", async () => {
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([{ id: "org-1" }] as never);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);

    await expect(accountDeletionBeforeDelete(user)).rejects.toBeInstanceOf(APIError);
    // throws before any destructive cleanup
    expect(deleteOrganization).not.toHaveBeenCalled();
    expect(prisma.invite.deleteMany).not.toHaveBeenCalled();
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
  });

  test("no sole-owner orgs: skips the license check and deletes only the creator's invites", async () => {
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValue([] as never);

    await expect(accountDeletionBeforeDelete(user)).resolves.toBeUndefined();

    expect(getIsMultiOrgEnabled).not.toHaveBeenCalled();
    expect(deleteOrganization).not.toHaveBeenCalled();
    expect(prisma.invite.deleteMany).toHaveBeenCalledWith({ where: { creatorId: "user-1" } });
  });
});

describe("accountDeletionAfterDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteBrevoCustomerByEmail).mockResolvedValue(undefined as never);
    vi.mocked(queueAccountDeletionAuditEvent).mockResolvedValue(undefined as never);
  });

  test("deletes the Brevo customer and queues a success audit event with the deleted user", async () => {
    await accountDeletionAfterDelete(user);

    expect(deleteBrevoCustomerByEmail).toHaveBeenCalledWith({ email: "ada@example.com" });
    expect(queueAccountDeletionAuditEvent).toHaveBeenCalledWith({
      oldUser: user,
      status: "success",
      targetUserId: "user-1",
    });
  });

  test("logs and swallows a Brevo failure, then still emits the audit event", async () => {
    vi.mocked(deleteBrevoCustomerByEmail).mockRejectedValue(new Error("brevo unreachable"));

    await expect(accountDeletionAfterDelete(user)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
    expect(queueAccountDeletionAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", targetUserId: "user-1" })
    );
  });
});

describe("accountDeletionConfig", () => {
  test("is enabled, wires both hooks, and sets no global delete-verification email", () => {
    expect(accountDeletionConfig.enabled).toBe(true);
    expect(accountDeletionConfig.beforeDelete).toBe(accountDeletionBeforeDelete);
    expect(accountDeletionConfig.afterDelete).toBe(accountDeletionAfterDelete);
    expect("sendDeleteAccountVerification" in accountDeletionConfig).toBe(false);
  });
});
