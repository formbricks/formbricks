import "server-only";
import { ZId } from "@formbricks/types/common";
import { can } from "../authorization";
import { validateInputs } from "../utils/validate";

export const canUserAccessOrganization = async (userId: string, organizationId: string): Promise<boolean> => {
  validateInputs([userId, ZId], [organizationId, ZId]);

  return can({ type: "user", id: userId }, "organization.read", { type: "organization", id: organizationId });
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
  const actor = { type: "user", id: userId } as const;
  const organization = { type: "organization", id: organizationId } as const;
  const [hasOwnerAccess, hasManagerAccess] = await Promise.all([
    can(actor, "organization.write", organization),
    can(actor, "organization.manage", organization),
  ]);

  return {
    hasCreateOrUpdateAccess: hasOwnerAccess,
    hasDeleteAccess: hasOwnerAccess,
    hasCreateOrUpdateMembersAccess: hasManagerAccess,
    hasDeleteMembersAccess: hasManagerAccess,
    hasBillingAccess: hasManagerAccess,
  };
};
