import "server-only";
import { ZId } from "@formbricks/types/common";
import { getMembershipByUserIdOrganizationId } from "../membership/service";
import { getAccessFlags } from "../membership/utils";
import { validateInputs } from "../utils/validate";
import { getOrganizationsByUserId } from "./service";

export const canUserAccessOrganization = async (userId: string, organizationId: string): Promise<boolean> => {
  validateInputs([userId, ZId], [organizationId, ZId]);

  try {
    const userOrganizations = await getOrganizationsByUserId(userId);

    const givenOrganizationExists = userOrganizations.filter(
      (organization) => (organization.id = organizationId)
    );
    if (!givenOrganizationExists) {
      return false;
    }
    return true;
  } catch (error) {
    throw error;
  }
};

export const verifyUserRoleAccess = async (
  organizationId: string,
  userId: string
): Promise<{
  hasCreateOrUpdateAccess: boolean;
  hasDeleteAccess: boolean;
  hasCreateOrUpdateMembersAccess: boolean;
  hasDeleteMembersAccess: boolean;
  hasBillingAccess: boolean;
}> => {
  const accessObject = {
    hasCreateOrUpdateAccess: true,
    hasDeleteAccess: true,
    hasCreateOrUpdateMembersAccess: true,
    hasDeleteMembersAccess: true,
    hasBillingAccess: true,
  };

  const currentUserMembership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  const { isOwner, isManager } = getAccessFlags(currentUserMembership?.role);

  if (!isOwner) {
    accessObject.hasCreateOrUpdateAccess = false;
    accessObject.hasDeleteAccess = false;
    accessObject.hasCreateOrUpdateMembersAccess = false;
    accessObject.hasDeleteMembersAccess = false;
    accessObject.hasBillingAccess = false;
  }

  if (isManager) {
    accessObject.hasCreateOrUpdateMembersAccess = true;
    accessObject.hasDeleteMembersAccess = true;
    accessObject.hasBillingAccess = true;
  }

  return accessObject;
};
