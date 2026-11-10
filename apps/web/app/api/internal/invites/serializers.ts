import type { TOrganizationRole } from "@formbricks/types/memberships";

/** A pending invite's role, as the API returns it after a change. */
export type TInviteRoleResource = { id: string; role: TOrganizationRole };

export const serializeInviteRole = (inviteId: string, role: TOrganizationRole): TInviteRoleResource => ({
  id: inviteId,
  role,
});

/** A pending invite just created: its id, which the invite list shows once the page refreshes. */
export type TCreatedInviteResource = { id: string };

/** A fresh link to a pending invite, ready to share: the token is URL-encoded for the invite page. */
export type TInviteShareLinkResource = { inviteToken: string };
