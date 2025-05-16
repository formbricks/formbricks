import { describe, expect, test, vi } from "vitest";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { getMembershipByUserIdOrganizationId } from "../membership/service";
import { getAccessFlags } from "../membership/utils";
import { canUserAccessOrganization, verifyUserRoleAccess } from "./auth";
import { getOrganizationsByUserId } from "./service";

vi.mock("./service", () => ({
  getOrganizationsByUserId: vi.fn(),
}));

vi.mock("../membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("../membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

describe("auth", () => {
  describe("canUserAccessOrganization", () => {
    test("returns true when user has access to organization", async () => {
      const mockOrganizations: TOrganization[] = [
        {
          id: "org1",
          createdAt: new Date(),
          updatedAt: new Date(),
          name: "Org 1",
          billing: {
            stripeCustomerId: null,
            plan: "free",
            period: "monthly",
            limits: {
              projects: 3,
              monthly: {
                responses: 1500,
                miu: 2000,
              },
            },
            periodStart: new Date(),
          },
          isAIEnabled: false,
        },
      ];
      vi.mocked(getOrganizationsByUserId).mockResolvedValue(mockOrganizations);

      const result = await canUserAccessOrganization("user1", "org1");
      expect(result).toBe(true);
    });
  });

  describe("verifyUserRoleAccess", () => {
    test("returns all access for owner role", async () => {
      const mockMembership: TMembership = {
        organizationId: "org1",
        userId: "user1",
        accepted: true,
        role: "owner",
      };
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
      vi.mocked(getAccessFlags).mockReturnValue({
        isOwner: true,
        isManager: false,
        isBilling: false,
        isMember: false,
      });

      const result = await verifyUserRoleAccess("org1", "user1");
      expect(result).toEqual({
        hasCreateOrUpdateAccess: true,
        hasDeleteAccess: true,
        hasCreateOrUpdateMembersAccess: true,
        hasDeleteMembersAccess: true,
        hasBillingAccess: true,
      });
    });

    test("returns limited access for manager role", async () => {
      const mockMembership: TMembership = {
        organizationId: "org1",
        userId: "user1",
        accepted: true,
        role: "manager",
      };
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
      vi.mocked(getAccessFlags).mockReturnValue({
        isOwner: false,
        isManager: true,
        isBilling: false,
        isMember: false,
      });

      const result = await verifyUserRoleAccess("org1", "user1");
      expect(result).toEqual({
        hasCreateOrUpdateAccess: false,
        hasDeleteAccess: false,
        hasCreateOrUpdateMembersAccess: true,
        hasDeleteMembersAccess: true,
        hasBillingAccess: true,
      });
    });

    test("returns no access for member role", async () => {
      const mockMembership: TMembership = {
        organizationId: "org1",
        userId: "user1",
        accepted: true,
        role: "member",
      };
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
      vi.mocked(getAccessFlags).mockReturnValue({
        isOwner: false,
        isManager: false,
        isBilling: false,
        isMember: true,
      });

      const result = await verifyUserRoleAccess("org1", "user1");
      expect(result).toEqual({
        hasCreateOrUpdateAccess: false,
        hasDeleteAccess: false,
        hasCreateOrUpdateMembersAccess: false,
        hasDeleteMembersAccess: false,
        hasBillingAccess: false,
      });
    });
  });
});
