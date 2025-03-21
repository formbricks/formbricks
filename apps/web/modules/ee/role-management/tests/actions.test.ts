import {
  mockInviteDataBilling,
  mockInviteDataOwner,
  mockMembershipManager,
  mockMembershipMember,
  mockMembershipUpdateBilling,
  mockMembershipUpdateOwner,
  mockOrganizationFree,
  mockOrganizationId,
  mockOrganizationScale,
  mockOrganizationStartup,
  mockSession,
  mockUpdateInviteInput,
  mockUpdateMembershipInput,
  mockUpdatedMembership,
  mockUser,
} from "./__mocks__/actions.mock";
import "@/lib/utils/action-client-middleware";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { updateInvite } from "@/modules/ee/role-management/lib/invite";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { checkRoleManagementPermission } from "../actions";
import { updateInviteAction, updateMembershipAction } from "../actions";

// Mock all external dependencies
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getRoleManagementPermission: vi.fn(),
}));

vi.mock("@/modules/ee/role-management/lib/invite", () => ({
  updateInvite: vi.fn(),
}));

vi.mock("@formbricks/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/modules/ee/role-management/lib/membership", () => ({
  updateMembership: vi.fn(),
}));

vi.mock("@formbricks/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@formbricks/lib/organization/service", () => ({
  getOrganization: vi.fn(),
}));

vi.mock("@/lib/utils/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock constants without importing the actual module
vi.mock("@formbricks/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_MULTI_ORG_ENABLED: true,
  ENCRYPTION_KEY: "test-encryption-key",
  ENTERPRISE_LICENSE_KEY: "test-enterprise-license-key",
  GITHUB_ID: "test-github-id",
  GITHUB_SECRET: "test-github-secret",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
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
}));

vi.mock("@/lib/utils/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));
vi.mock("@formbricks/lib/errors", () => ({
  OperationNotAllowedError: vi.fn(),
  ValidationError: vi.fn(),
}));

describe("role-management/actions.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("checkRoleManagementPermission", () => {
    test("throws error when organization not found", async () => {
      vi.mocked(getOrganization).mockResolvedValue(null);

      await expect(checkRoleManagementPermission(mockOrganizationId)).rejects.toThrow(
        "Organization not found"
      );

      expect(getOrganization).toHaveBeenCalledWith(mockOrganizationId);
    });

    test("throws error when role management is not allowed", async () => {
      vi.mocked(getOrganization).mockResolvedValue(mockOrganizationFree);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(false);

      await expect(checkRoleManagementPermission(mockOrganizationId)).rejects.toThrow(
        new OperationNotAllowedError("Role management is not allowed for this organization")
      );

      expect(getRoleManagementPermission).toHaveBeenCalledWith("free");

      expect(getOrganization).toHaveBeenCalledWith(mockOrganizationId);
    });

    test("succeeds when role management is allowed", async () => {
      vi.mocked(getOrganization).mockResolvedValue(mockOrganizationStartup);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(true);

      await expect(checkRoleManagementPermission(mockOrganizationId)).resolves.toBeUndefined();
      await expect(getRoleManagementPermission).toHaveBeenCalledWith("startup");
      expect(getOrganization).toHaveBeenCalledWith(mockOrganizationId);
    });
  });

  describe("updateInviteAction", () => {
    test("throws error when user is not a member of the organization", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

      expect(await updateInviteAction(mockUpdateInviteInput)).toStrictEqual({
        serverError: "User not a member of this organization",
      });
    });

    test("throws error when billing role is not allowed in self-hosted", async () => {
      const inputWithBillingRole = {
        ...mockUpdateInviteInput,
        data: mockInviteDataBilling,
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembershipMember);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);

      expect(await updateInviteAction(inputWithBillingRole)).toStrictEqual({
        serverError: "Something went wrong while executing the operation.",
      });
    });

    test("throws error when manager tries to assign non-member role", async () => {
      const inputWithOwnerRole = {
        ...mockUpdateInviteInput,
        data: mockInviteDataOwner,
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembershipManager);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);

      expect(await updateInviteAction(inputWithOwnerRole)).toStrictEqual({
        serverError: "Managers can only invite members",
      });
    });

    test("successfully updates invite", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembershipManager);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
      vi.mocked(getOrganization).mockResolvedValue(mockOrganizationScale);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(true);
      vi.mocked(updateInvite).mockResolvedValue(true);

      const result = await updateInviteAction(mockUpdateInviteInput);

      expect(result).toEqual({ data: true });
    });
  });

  describe("updateMembershipAction", () => {
    test("throws error when user is not a member of the organization", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

      expect(await updateMembershipAction(mockUpdateMembershipInput)).toStrictEqual({
        serverError: "User not a member of this organization",
      });
    });

    test("throws error when billing role is not allowed in self-hosted", async () => {
      const inputWithBillingRole = {
        ...mockUpdateMembershipInput,
        data: mockMembershipUpdateBilling,
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembershipMember);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);

      expect(await updateMembershipAction(inputWithBillingRole)).toStrictEqual({
        serverError: "Something went wrong while executing the operation.",
      });
    });

    test("throws error when manager tries to assign non-member role", async () => {
      const inputWithOwnerRole = {
        ...mockUpdateMembershipInput,
        data: mockMembershipUpdateOwner,
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembershipManager);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);

      expect(await updateMembershipAction(inputWithOwnerRole)).toStrictEqual({
        serverError: "Managers can only assign users to the member role",
      });
    });

    test("successfully updates membership", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(getUser).mockResolvedValue(mockUser);
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembershipManager);
      vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
      vi.mocked(getOrganization).mockResolvedValue(mockOrganizationScale);
      vi.mocked(getRoleManagementPermission).mockResolvedValue(true);
      vi.mocked(updateMembership).mockResolvedValue(mockUpdatedMembership);

      const result = await updateMembershipAction(mockUpdateMembershipInput);

      expect(result).toEqual({
        data: mockUpdatedMembership,
      });
    });
  });
});
