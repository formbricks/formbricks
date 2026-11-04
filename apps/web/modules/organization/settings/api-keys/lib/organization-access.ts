import "server-only";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { assertUserManagementAllowed, canManageUsers } from "@/lib/membership/user-management";

/**
 * Whether `userId` clears the organization's user-management floor, so may mint a key with organization
 * write access. The floor itself is `canManageUsers`; this name is what the settings page and the mint
 * action share, so the toggle cannot be offered where the action would refuse it.
 */
export const canGrantOrganizationWriteAccess = canManageUsers;

/**
 * ENG-3075: the floor has to be applied when the key is minted, not when it is used.
 *
 * API keys are owned by the organization rather than by whoever created them — a key set up by an
 * engineer who later leaves has to keep working — so the authority a key carries is fixed once, here,
 * instead of being re-derived from the creator's current role on every request.
 *
 * Only `write` is gated. The v2 organization routes apply the floor to writes alone; org read access
 * grants nothing beyond listing the organization's users and teams.
 */
export const assertCanGrantOrganizationAccess = async (
  userId: string,
  organizationId: string,
  organizationAccess: TOrganizationAccess
): Promise<void> => {
  if (organizationAccess?.accessControl?.write !== true) return;

  await assertUserManagementAllowed(userId, organizationId);
};
