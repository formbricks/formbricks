import "server-only";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";

/**
 * Whether `userId` clears the organization's user-management floor.
 *
 * `organization.manage_access` is `USER_MANAGEMENT_MINIMUM_ROLE` expressed in the central
 * authorization vocabulary: `lib/authorization/spicedb-evaluator.ts` maps the floor onto the schema
 * (`owner` → write, `manager` → manage_access, `disabled` → deny), and
 * `lib/authorization/manage-access.integration.test.ts` pins it to `getUserManagementAccess` against
 * real rows. Asking it through one helper keeps the settings page and the mint action on the same
 * question, so the toggle cannot be offered where the action would refuse it.
 */
export const canGrantOrganizationWriteAccess = async (
  userId: string,
  organizationId: string
): Promise<boolean> =>
  can({ type: "user", id: userId }, "organization.manage_access", {
    type: "organization",
    id: organizationId,
  });

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

  if (!(await canGrantOrganizationWriteAccess(userId, organizationId))) {
    throw new OperationNotAllowedError("User management is not allowed for your role");
  }
};
