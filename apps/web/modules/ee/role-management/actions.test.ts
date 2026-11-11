import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { updateInviteAction, updateMembershipAction } from "./actions";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  assertCan: vi.fn(),
  can: vi.fn(),
  checkAuthorizationUpdated: vi.fn(),
  getAccessControlPermission: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationIdFromInviteId: vi.fn(),
  getInvite: vi.fn(),
  getOrganizationOwnerCount: vi.fn(),
  lockOrganizationOwners: vi.fn(),
  updateInvite: vi.fn(),
  updateMembership: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({
  assertCan: mocks.assertCan,
  can: mocks.can,
}));

vi.mock("@formbricks/database", () => ({
  // The last-owner guard runs the owner-count re-check and the update inside one transaction;
  // the fake just invokes the callback with a stand-in tx so both still hit the mocks below.
  prisma: { $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback({})) },
}));

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
  USER_MANAGEMENT_MINIMUM_ROLE: "manager",
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mocks.applyRateLimit,
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: mocks.getOrganization,
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromInviteId: mocks.getOrganizationIdFromInviteId,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: mocks.getAccessControlPermission,
}));

vi.mock("@/modules/ee/role-management/lib/invite", () => ({
  updateInvite: mocks.updateInvite,
}));

vi.mock("@/modules/ee/role-management/lib/membership", () => ({
  updateMembership: mocks.updateMembership,
}));

vi.mock("@/modules/organization/settings/teams/lib/invite", () => ({
  getInvite: mocks.getInvite,
}));

vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({
  getOrganizationOwnerCount: mocks.getOrganizationOwnerCount,
  lockOrganizationOwners: mocks.lockOrganizationOwners,
}));

const organizationId = "cm9gptbhg0000192zceq9ayuc";
const currentUserId = "cm9gptbhg0001192zceq9ayud";
const targetUserId = "cm9gptbhg0002192zceq9ayue";

const membership = (userId: string, role: string) => ({ userId, organizationId, role, accepted: true });

const callUpdateMembership = (role: string) =>
  updateMembershipAction({
    ctx: { user: { id: currentUserId, locale: "en-US" }, auditLoggingCtx: {} },
    parsedInput: { userId: targetUserId, organizationId, data: { role } },
  } as any);

describe("updateMembershipAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.assertCan.mockResolvedValue(undefined);
    mocks.can.mockResolvedValue(true);
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.getAccessControlPermission.mockResolvedValue(true);
    mocks.getOrganization.mockResolvedValue({ id: organizationId });
    mocks.getMembershipByUserIdOrganizationId.mockImplementation(async (userId: string) =>
      membership(userId, "owner")
    );
    mocks.getOrganizationOwnerCount.mockResolvedValue(2);
    mocks.updateMembership.mockImplementation(async (userId: string, _orgId: string, data: any) =>
      membership(userId, data.role)
    );
  });

  test("rejects demoting the last owner of the organization", async () => {
    mocks.getOrganizationOwnerCount.mockResolvedValue(1);

    await expect(callUpdateMembership("member")).rejects.toThrow(ValidationError);
    expect(mocks.updateMembership).not.toHaveBeenCalled();
    // Counted under the owners' lock, the one every last-owner check takes.
    expect(mocks.lockOrganizationOwners).toHaveBeenCalledWith(expect.anything(), organizationId);
    expect(mocks.lockOrganizationOwners.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getOrganizationOwnerCount.mock.invocationCallOrder[0]
    );
  });

  test("allows demoting an owner when the organization has another owner", async () => {
    mocks.getOrganizationOwnerCount.mockResolvedValue(2);

    await expect(callUpdateMembership("member")).resolves.toMatchObject({ role: "member" });
    expect(mocks.getOrganizationOwnerCount).toHaveBeenCalledWith(organizationId, expect.anything());
    expect(mocks.updateMembership).toHaveBeenCalledWith(
      targetUserId,
      organizationId,
      { role: "member" },
      expect.anything()
    );
  });

  test("allows changing a non-owner's role", async () => {
    mocks.getMembershipByUserIdOrganizationId.mockImplementation(async (userId: string) =>
      membership(userId, userId === currentUserId ? "owner" : "member")
    );

    await expect(callUpdateMembership("manager")).resolves.toMatchObject({ role: "manager" });
  });

  test("allows keeping an owner's role unchanged", async () => {
    await expect(callUpdateMembership("owner")).resolves.toMatchObject({ role: "owner" });
  });

  test("still rejects a manager demoting an owner before the owner count is read", async () => {
    mocks.getMembershipByUserIdOrganizationId.mockImplementation(async (userId: string) =>
      membership(userId, userId === currentUserId ? "manager" : "owner")
    );

    await expect(callUpdateMembership("member")).rejects.toThrow(OperationNotAllowedError);
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });
});

const denyManageAccess = () =>
  mocks.can.mockImplementation(async (_actor, action: string) => action !== "organization.manage_access");

describe("updateMembershipAction below the user-management floor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    denyManageAccess();
    mocks.getMembershipByUserIdOrganizationId.mockImplementation(async (userId: string) =>
      membership(userId, userId === currentUserId ? "manager" : "member")
    );
  });

  test("refuses the change", async () => {
    await expect(callUpdateMembership("member")).rejects.toThrow(OperationNotAllowedError);
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });
});

describe("updateInviteAction", () => {
  const inviteId = "5f1c9d3e-8a2b-4c6d-9e0f-1a2b3c4d5e6f";

  const callUpdateInvite = (role: string) =>
    updateInviteAction({
      ctx: { user: { id: currentUserId, locale: "en-US" }, auditLoggingCtx: {} },
      parsedInput: { inviteId, data: { role } },
    } as never);

  const asCaller = (role: string) =>
    mocks.getMembershipByUserIdOrganizationId.mockResolvedValue(membership(currentUserId, role));

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.assertCan.mockResolvedValue(undefined);
    mocks.can.mockResolvedValue(true);
    mocks.getAccessControlPermission.mockResolvedValue(true);
    mocks.getOrganization.mockResolvedValue({ id: organizationId });
    mocks.getOrganizationIdFromInviteId.mockResolvedValue(organizationId);
    mocks.updateInvite.mockResolvedValue(true);
    asCaller("manager");
  });

  // ENG-6812: the invite path asked only `organization.manage`, so an owner-only floor did not hold.
  test("refuses a manager below the user-management floor", async () => {
    denyManageAccess();

    await expect(callUpdateInvite("member")).rejects.toThrow(OperationNotAllowedError);
    expect(mocks.can).toHaveBeenCalledWith(
      { type: "user", id: currentUserId },
      "organization.manage_access",
      { type: "organization", id: organizationId }
    );
    expect(mocks.updateInvite).not.toHaveBeenCalled();
  });

  test("keeps owner invites out of a manager's reach", async () => {
    await expect(callUpdateInvite("member")).resolves.toBe(true);
    expect(mocks.updateInvite).toHaveBeenCalledWith(
      inviteId,
      { role: "member" },
      { allowOwnerInvite: false }
    );
  });

  test("records the role change in the audit event", async () => {
    const ctx = {
      user: { id: currentUserId, locale: "en-US" },
      auditLoggingCtx: {} as Record<string, unknown>,
    };
    mocks.getInvite.mockResolvedValue({
      email: "invitee@example.com",
      role: "manager",
      creator: { name: "O" },
    });

    await updateInviteAction({ ctx, parsedInput: { inviteId, data: { role: "member" } } } as never);

    expect(ctx.auditLoggingCtx.oldObject).toMatchObject({ role: "manager" });
    expect(ctx.auditLoggingCtx.newObject).toMatchObject({ email: "invitee@example.com", role: "member" });
  });

  test("lets an owner change an owner invite", async () => {
    asCaller("owner");

    await expect(callUpdateInvite("manager")).resolves.toBe(true);
    expect(mocks.updateInvite).toHaveBeenCalledWith(
      inviteId,
      { role: "manager" },
      { allowOwnerInvite: true }
    );
  });
});
