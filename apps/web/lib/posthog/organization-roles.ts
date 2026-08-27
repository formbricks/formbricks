import "server-only";
import { getMembershipsByUserId } from "@/lib/membership/service";

export type TPostHogOrganizationRoleProperties = {
  organization_roles: { organization_id: string; role: string }[];
  organization_count: number;
};

export const getOrganizationRolePersonProperties = async (
  userId: string
): Promise<TPostHogOrganizationRoleProperties> => {
  const memberships = await getMembershipsByUserId(userId);

  return {
    organization_roles: memberships.map((membership) => ({
      organization_id: membership.organizationId,
      role: membership.role,
    })),
    organization_count: memberships.length,
  };
};
