import {
  mockDeleteMembershipInput,
  mockDeletedMemberMembership,
  mockDeletedMembership,
  mockInviteId,
  mockInviteToken,
  mockInviteUserInput,
  mockInviteWithCreator,
  mockInviteeEmail,
  mockInviteeName,
  mockLeaveOrganizationInput,
  mockManagerMembership,
  mockMemberMembership,
  mockMultipleMemberships,
  mockNonOwnerAccessFlags,
  mockOrganizationId,
  mockOtherUserId,
  mockOwnerAccessFlags,
  mockOwnerMembership,
  mockResendInviteResponse,
  mockSession,
  mockSingleMembership,
  mockUser,
  mockUserId,
  mockUserName,
} from "./__mocks__/actions.mock";
import { createInviteToken } from "@/lib/jwt";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getUser } from "@/lib/user/service";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromInviteId } from "@/lib/utils/helper";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/actions";
import { sendInviteMemberEmail } from "@/modules/email";
import { OrganizationRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createInviteTokenAction,
  deleteInviteAction,
  deleteMembershipAction,
  inviteUserAction,
  leaveOrganizationAction,
  resendInviteAction,
} from "../actions";
import { deleteInvite, getInvite, inviteUser, resendInvite } from "../lib/invite";
import { deleteMembership, getMembershipsByUserId, getOrganizationOwnerCount } from "../lib/membership";

vi.mock("@/lib/utils/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromInviteId: vi.fn(() => Promise.resolve(mockOrganizationId)),
}));

vi.mock("../lib/invite", () => ({
  deleteInvite: vi.fn(),
  getInvite: vi.fn(),
  inviteUser: vi.fn(),
  resendInvite: vi.fn(),
}));

vi.mock("../lib/membership", () => ({
  deleteMembership: vi.fn(),
  getMembershipsByUserId: vi.fn(),
  getOrganizationOwnerCount: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/modules/email", () => ({
  sendInviteMemberEmail: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({
  createInviteToken: vi.fn(),
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

vi.mock("@/modules/ee/role-management/actions", () => ({
  checkRoleManagementPermission: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
}));

// Mock constants without importing the actual module
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_MULTI_ORG_ENABLED: true,
  ENCRYPTION_KEY: "test-encryption-key",
  ENTERPRISE_LICENSE_KEY: "test-enterprise-license-key",
  GITHUB_ID: "test-github-id",
  GITHUB_SECRET: "test-github-secret",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  INVITE_DISABLED: 0,
  AZUREAD_CLIENT_ID: "test-azure-client-id",
  AZUREAD_CLIENT_SECRET: "test-azure-client-secret",
  AZUREAD_TENANT_ID: "test-azure-tenant-id",
  OIDC_CLIENT_ID: "test-oidc-client-id",
  OIDC_CLIENT_SECRET: "test-oidc-client-secret",
  OIDC_ISSUER: "test-oidc-issuer",
  OIDC_DISPLAY_NAME: "test-oidc-display-name",
  OIDC_SIGNING_ALGORITHM: "test-oidc-algorithm",
  SAML_DATABASE_URL: "test-saml-db-url",
  NEXTAUTH_SECRET: "test-nextauth-secret",
  WEBAPP_URL: "http://localhost:3000",
  AUDIT_LOG_ENABLED: true,
  AUDIT_LOG_GET_USER_IP: false,
  SESSION_MAX_AGE: 1000,
  REDIS_URL: "redis://localhost:6379",
}));

describe("Organization Settings Teams Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("deleteInviteAction", () => {
    test("deletes an invite when authorized", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      vi.mocked(deleteInvite).mockResolvedValueOnce(true);

      await expect(
        await deleteInviteAction({
          inviteId: mockInviteId,
          organizationId: mockOrganizationId,
        })
      ).toStrictEqual({
        data: true,
      });

      expect(deleteInvite).toHaveBeenCalledWith(mockInviteId);
    });
  });

  describe("createInviteTokenAction", () => {
    test("creates an invite token when authorized", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      vi.mocked(getInvite).mockResolvedValueOnce(mockInviteWithCreator);
      vi.mocked(createInviteToken).mockReturnValueOnce(mockInviteToken);

      const result = await createInviteTokenAction({
        inviteId: mockInviteId,
      });

      expect(createInviteToken).toHaveBeenCalledWith(mockInviteId, mockInviteWithCreator.email, {
        expiresIn: "7d",
      });
      expect(result).toEqual({ data: { inviteToken: encodeURIComponent(mockInviteToken) } });
    });

    test("throws an error if invite is not found", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      vi.mocked(getInvite).mockResolvedValueOnce(null);

      await expect(
        await createInviteTokenAction({
          inviteId: mockInviteId,
        })
      ).toStrictEqual({
        serverError: "Something went wrong while executing the operation.",
      });
    });
  });

  describe("deleteMembershipAction", () => {
    test("deletes a membership when authorized", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockOwnerMembership);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      vi.mocked(getMembershipByUserIdOrganizationId)
        .mockResolvedValueOnce(mockOwnerMembership)
        .mockResolvedValueOnce(mockMemberMembership);

      vi.mocked(deleteMembership).mockResolvedValueOnce([mockDeletedMembership]);

      await expect(
        await deleteMembershipAction({
          organizationId: mockOrganizationId,
          userId: mockOtherUserId,
        })
      ).toStrictEqual({
        data: [mockDeletedMembership],
      });

      expect(deleteMembership).toHaveBeenCalledWith(mockOtherUserId, mockOrganizationId);
    });

    test("throws an error when trying to delete yourself", async () => {
      const input = { ...mockDeleteMembershipInput, userId: mockUserId };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockOwnerMembership);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      expect(
        await deleteMembershipAction({
          ...input,
        })
      ).toStrictEqual({
        serverError: "You cannot delete yourself from the organization",
      });
    });

    test("throws an error when manager tries to delete an owner", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId)
        .mockResolvedValueOnce(mockManagerMembership)
        .mockResolvedValueOnce(mockOwnerMembership);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      expect(
        await deleteMembershipAction({
          ...mockDeleteMembershipInput,
        })
      ).toStrictEqual({
        serverError: "You cannot delete the owner of the organization",
      });
    });

    test("throws an error when deleting the last owner", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockOwnerMembership);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      vi.mocked(getMembershipByUserIdOrganizationId)
        .mockResolvedValueOnce(mockOwnerMembership)
        .mockResolvedValueOnce(mockOwnerMembership);

      vi.mocked(getOrganizationOwnerCount).mockResolvedValueOnce(1);

      expect(
        await deleteMembershipAction({
          ...mockDeleteMembershipInput,
        })
      ).toStrictEqual({
        serverError: "Something went wrong while executing the operation.",
      });
    });
  });

  describe("resendInviteAction", () => {
    test("resends an invite when authorized", async () => {
      vi.mocked(getOrganizationIdFromInviteId).mockResolvedValueOnce(mockOrganizationId);

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      vi.mocked(getInvite).mockResolvedValueOnce(mockInviteWithCreator);
      vi.mocked(resendInvite).mockResolvedValueOnce(mockResendInviteResponse);

      await resendInviteAction({
        inviteId: mockInviteId,
        organizationId: mockOrganizationId,
      });

      expect(resendInvite).toHaveBeenCalledWith(mockInviteId);
      expect(sendInviteMemberEmail).toHaveBeenCalledWith(
        mockInviteId,
        mockInviteeEmail,
        mockUserName,
        mockInviteeName,
        undefined,
        "en-US"
      );
    });

    test("throws an error when invite does not belong to organization", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      vi.mocked(getOrganizationIdFromInviteId).mockResolvedValueOnce("different-org-id");

      expect(
        await resendInviteAction({
          inviteId: mockInviteId,
          organizationId: mockOrganizationId,
        })
      ).toStrictEqual({
        serverError: "Something went wrong while executing the operation.",
      });
    });
  });

  describe("inviteUserAction", () => {
    test("invites a user when authorized", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(mockOwnerMembership);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      vi.mocked(inviteUser).mockResolvedValueOnce(mockInviteId);

      const result = await inviteUserAction({
        ...mockInviteUserInput,
      });

      expect(inviteUser).toHaveBeenCalledWith({
        organizationId: mockOrganizationId,
        invitee: {
          email: mockInviteeEmail,
          name: mockInviteeName,
          role: "member",
          teamIds: [mockInviteUserInput.teamIds[0]],
        },
        currentUserId: mockUserId,
      });

      expect(sendInviteMemberEmail).toHaveBeenCalled();
      expect(result).toStrictEqual({ data: mockInviteId });
    });

    test("throws an error when manager tries to invite non-member role", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(mockManagerMembership);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      const input = { ...mockInviteUserInput, role: OrganizationRole.owner };

      expect(
        await inviteUserAction({
          ...input,
        })
      ).toStrictEqual({
        serverError: "Managers can only invite users as members",
      });
    });

    test("checks role management permission for non-owner roles or team assignments", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(mockOwnerMembership);

      vi.mocked(inviteUser).mockResolvedValueOnce(mockInviteId);

      await expect(
        await inviteUserAction({
          ...mockInviteUserInput,
        })
      ).toStrictEqual({
        data: mockInviteId,
      });

      expect(checkRoleManagementPermission).toHaveBeenCalledWith(mockOrganizationId);
    });
  });

  describe("leaveOrganizationAction", () => {
    test("allows a non-owner to leave an organization", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(mockMemberMembership);

      vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);

      vi.mocked(getAccessFlags).mockReturnValueOnce(mockNonOwnerAccessFlags);
      vi.mocked(getIsMultiOrgEnabled).mockResolvedValueOnce(true);
      vi.mocked(getMembershipsByUserId).mockResolvedValueOnce(mockMultipleMemberships);
      vi.mocked(deleteMembership).mockResolvedValueOnce([mockDeletedMemberMembership]);

      expect(
        await leaveOrganizationAction({
          ...mockLeaveOrganizationInput,
        })
      ).toStrictEqual({
        data: [mockDeletedMemberMembership],
      });

      expect(deleteMembership).toHaveBeenCalledWith(mockUserId, mockOrganizationId);
    });

    test("throws an error when an owner tries to leave", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(mockOwnerMembership);

      vi.mocked(getAccessFlags).mockReturnValueOnce(mockOwnerAccessFlags);

      expect(
        await leaveOrganizationAction({
          ...mockLeaveOrganizationInput,
        })
      ).toStrictEqual({
        serverError: "You cannot leave an organization you own",
      });
    });

    test("throws an error when user tries to leave their only organization", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(mockMemberMembership);

      vi.mocked(getAccessFlags).mockReturnValueOnce(mockNonOwnerAccessFlags);
      vi.mocked(getIsMultiOrgEnabled).mockResolvedValueOnce(true);
      vi.mocked(getMembershipsByUserId).mockResolvedValueOnce(mockSingleMembership);

      expect(
        await leaveOrganizationAction({
          ...mockLeaveOrganizationInput,
        })
      ).toStrictEqual({
        serverError: "Something went wrong while executing the operation.",
      });
    });
  });
});
