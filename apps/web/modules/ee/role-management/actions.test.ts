import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import {
  TUpdateInviteAction,
  checkRoleManagementPermission,
  updateInviteAction,
  updateMembershipAction,
} from "@/modules/ee/role-management/actions";
import { updateInvite } from "@/modules/ee/role-management/lib/invite";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError, OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";

// Mock constants with getter functions to allow overriding in tests
let mockIsFormbricksCloud = false;
let mockUserManagementMinimumRole = "owner";

vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return mockIsFormbricksCloud;
  },
  get USER_MANAGEMENT_MINIMUM_ROLE() {
    return mockUserManagementMinimumRole;
  },
  REDIS_URL: "redis://localhost:6379",
  AUDIT_LOG_ENABLED: 1,
  ENCRYPTION_KEY: "test-encryption-key",
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(),
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getRoleManagementPermission: vi.fn(),
}));

vi.mock("@/lib/utils/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));

vi.mock("@/modules/ee/role-management/lib/invite", () => ({
  updateInvite: vi.fn(),
}));

vi.mock("@/modules/ee/role-management/lib/membership", () => ({
  updateMembership: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    schema: () => ({
      action: (callback) => callback,
    }),
  },
}));

describe("Role Management Actions", () => {
  afterEach(() => {
    vi.resetAllMocks();
    mockIsFormbricksCloud = false;
    mockUserManagementMinimumRole = "owner";
  });

  describe("checkRoleManagementPermission", () => {
    test("throws error if organization not found", async () => {
      vi.mocked(getOrganization).mockResolvedValue(null);

      await expect(checkRoleManagementPermission("org-123")).rejects.toThrow("Organization not found");
    });

    test("throws error if role management is not allowed", async () => {
      vi.mocked(getOrganization).mockResolvedValue({
        billing: { plan: "free" },
      } as any);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(false);

      await expect(checkRoleManagementPermission("org-123")).rejects.toThrow(
        new OperationNotAllowedError("Role management is not allowed for this organization")
      );
    });

    test("succeeds if role management is allowed", async () => {
      vi.mocked(getOrganization).mockResolvedValue({
        billing: { plan: "pro" },
      } as any);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(true);

      await expect(checkRoleManagementPermission("org-123")).resolves.not.toThrow();
    });
  });

  describe("updateInviteAction", () => {
    test("throws error if user is not a member of the organization", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

      await expect(
        updateInviteAction({
          ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
          parsedInput: {
            inviteId: "invite-123",
            organizationId: "org-123",
            data: { role: "member" },
          },
        } as unknown as TUpdateInviteAction)
      ).rejects.toThrow(new AuthenticationError("User not a member of this organization"));
    });

    test("throws error if billing role is not allowed in self-hosted", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as any);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);

      await expect(
        updateInviteAction({
          ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
          parsedInput: {
            inviteId: "invite-123",
            organizationId: "org-123",
            data: { role: "billing" },
          },
        } as unknown as TUpdateInviteAction)
      ).rejects.toThrow(new ValidationError("Billing role is not allowed"));
    });

    test("allows billing role in cloud environment", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as any);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
      mockIsFormbricksCloud = true;
      vi.mocked(getOrganization).mockResolvedValue({ billing: { plan: "pro" } } as any);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(true);
      vi.mocked(updateInvite).mockResolvedValue({ id: "invite-123", role: "billing" } as any);

      const result = await updateInviteAction({
        ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
        parsedInput: {
          inviteId: "invite-123",
          organizationId: "org-123",
          data: { role: "billing" },
        },
      } as unknown as TUpdateInviteAction);

      expect(result).toEqual({ id: "invite-123", role: "billing" });
    });

    test("throws error if manager tries to invite a role other than member", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "manager" } as any);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);

      await expect(
        updateInviteAction({
          ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
          parsedInput: {
            inviteId: "invite-123",
            organizationId: "org-123",
            data: { role: "owner" },
          },
        } as unknown as TUpdateInviteAction)
      ).rejects.toThrow(new OperationNotAllowedError("Managers can only invite members"));
    });

    test("allows manager to invite a member", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "manager" } as any);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
      vi.mocked(getOrganization).mockResolvedValue({ billing: { plan: "pro" } } as any);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(true);
      vi.mocked(updateInvite).mockResolvedValue({ id: "invite-123", role: "member" } as any);

      const result = await updateInviteAction({
        ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
        parsedInput: {
          inviteId: "invite-123",
          organizationId: "org-123",
          data: { role: "member" },
        },
      } as unknown as TUpdateInviteAction);

      expect(result).toEqual({ id: "invite-123", role: "member" });
      expect(updateInvite).toHaveBeenCalledWith("invite-123", { role: "member" });
    });

    test("successful invite update as owner", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as any);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
      vi.mocked(getOrganization).mockResolvedValue({ billing: { plan: "pro" } } as any);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(true);
      vi.mocked(updateInvite).mockResolvedValue({ id: "invite-123", role: "member" } as any);

      const result = await updateInviteAction({
        ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
        parsedInput: {
          inviteId: "invite-123",
          organizationId: "org-123",
          data: { role: "member" },
        },
      } as unknown as TUpdateInviteAction);

      expect(result).toEqual({ id: "invite-123", role: "member" });
      expect(updateInvite).toHaveBeenCalledWith("invite-123", { role: "member" });
    });
  });

  describe("updateMembershipAction", () => {
    test("throws error if user is not a member of the organization", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

      await expect(
        updateMembershipAction({
          ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
          parsedInput: {
            userId: "user-456",
            organizationId: "org-123",
            data: { role: "member" },
          },
        } as any)
      ).rejects.toThrow(new AuthenticationError("User not a member of this organization"));
    });

    test("throws error if user management is disabled", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as any);
      mockUserManagementMinimumRole = "disabled";

      await expect(
        updateMembershipAction({
          ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
          parsedInput: {
            userId: "user-456",
            organizationId: "org-123",
            data: { role: "member" },
          },
        } as any)
      ).rejects.toThrow(new OperationNotAllowedError("User management is not allowed for your role"));
    });

    test("throws error if billing role is not allowed in self-hosted", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as any);
      mockUserManagementMinimumRole = "owner";
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);

      await expect(
        updateMembershipAction({
          ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
          parsedInput: {
            userId: "user-456",
            organizationId: "org-123",
            data: { role: "billing" },
          },
        } as any)
      ).rejects.toThrow(new ValidationError("Billing role is not allowed"));
    });

    test("allows billing role in cloud environment", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as any);
      mockUserManagementMinimumRole = "owner";
      mockIsFormbricksCloud = true;
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
      vi.mocked(getOrganization).mockResolvedValue({ billing: { plan: "pro" } } as any);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(true);
      vi.mocked(updateMembership).mockResolvedValue({ id: "membership-123", role: "billing" } as any);

      const result = await updateMembershipAction({
        ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
        parsedInput: {
          userId: "user-456",
          organizationId: "org-123",
          data: { role: "billing" },
        },
      } as any);

      expect(result).toEqual({ id: "membership-123", role: "billing" });
    });

    test("throws error if manager tries to assign a role other than member", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "manager" } as any);
      mockUserManagementMinimumRole = "manager";
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);

      await expect(
        updateMembershipAction({
          ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
          parsedInput: {
            userId: "user-456",
            organizationId: "org-123",
            data: { role: "owner" },
          },
        } as any)
      ).rejects.toThrow(new OperationNotAllowedError("Managers can only assign users to the member role"));
    });

    test("allows manager to assign member role", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "manager" } as any);
      mockUserManagementMinimumRole = "manager";
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
      vi.mocked(getOrganization).mockResolvedValue({ billing: { plan: "pro" } } as any);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(true);
      vi.mocked(updateMembership).mockResolvedValue({ id: "membership-123", role: "member" } as any);

      const result = await updateMembershipAction({
        ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
        parsedInput: {
          userId: "user-456",
          organizationId: "org-123",
          data: { role: "member" },
        },
      } as any);

      expect(result).toEqual({ id: "membership-123", role: "member" });
      expect(updateMembership).toHaveBeenCalledWith("user-456", "org-123", { role: "member" });
    });

    test("successful membership update as owner", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as any);
      mockUserManagementMinimumRole = "owner";
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
      vi.mocked(getOrganization).mockResolvedValue({ billing: { plan: "pro" } } as any);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(true);
      vi.mocked(updateMembership).mockResolvedValue({ id: "membership-123", role: "member" } as any);

      const result = await updateMembershipAction({
        ctx: { user: { id: "user-123" }, auditLoggingCtx: {} },
        parsedInput: {
          userId: "user-456",
          organizationId: "org-123",
          data: { role: "member" },
        },
      } as any);

      expect(result).toEqual({ id: "membership-123", role: "member" });
      expect(updateMembership).toHaveBeenCalledWith("user-456", "org-123", { role: "member" });
    });
  });
});
