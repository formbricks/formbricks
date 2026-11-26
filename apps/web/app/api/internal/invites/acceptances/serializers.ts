import type { TMembership } from "@formbricks/types/memberships";

/** The membership an accepted invite created. */
export type TInviteAcceptanceResource = Pick<TMembership, "organizationId" | "role">;

export const serializeInviteAcceptance = (membership: TMembership): TInviteAcceptanceResource => ({
  organizationId: membership.organizationId,
  role: membership.role,
});
