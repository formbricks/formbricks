import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { updateMembershipAction } from "./actions";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  assertCan: vi.fn(),
  can: vi.fn(),
  checkAuthorizationUpdated: vi.fn(),
  getAccessControlPermission: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationOwnerCount: vi.fn(),
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

vi.mock("@formbricks/database/prisma", () => ({
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
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
  getOrganizationIdFromInviteId: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: mocks.getAccessControlPermission,
}));

vi.mock("@/modules/ee/role-management/lib/invite", () => ({
  updateInvite: vi.fn(),
}));

vi.mock("@/modules/ee/role-management/lib/membership", () => ({
  updateMembership: mocks.updateMembership,
}));

vi.mock("@/modules/organization/settings/teams/lib/invite", () => ({
  getInvite: vi.fn(),
}));

vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({
  getOrganizationOwnerCount: mocks.getOrganizationOwnerCount,
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
