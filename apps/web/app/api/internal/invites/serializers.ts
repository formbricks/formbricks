import type { TOrganizationRole } from "@formbricks/types/memberships";

/** A pending invite's role, as the API returns it after a change. */
export type TInviteRoleResource = { id: string; role: TOrganizationRole };

export const serializeInviteRole = (inviteId: string, role: TOrganizationRole): TInviteRoleResource => ({
  id: inviteId,
  role,
});
