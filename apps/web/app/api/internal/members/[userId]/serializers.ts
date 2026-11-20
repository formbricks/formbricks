import type { TMembership, TOrganizationRole } from "@formbricks/types/memberships";

/** A member's role in one organization, as the API returns it after a change. */
export type TMemberRoleResource = { userId: string; organizationId: string; role: TOrganizationRole };

export const serializeMemberRole = (membership: TMembership): TMemberRoleResource => ({
  userId: membership.userId,
  organizationId: membership.organizationId,
  role: membership.role,
});
