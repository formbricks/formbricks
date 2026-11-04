import type { TOrganizationRole } from "@formbricks/types/memberships";

/**
 * The order every organization-role picker lists roles in: most access first, Dashboard viewer last.
 * `getAssignableOrganizationRoles` lists them least access first; the pickers used to flip that with
 * `flex-col-reverse`, which also reversed the keyboard order. Reordering the data keeps what is seen and
 * what is tabbed through the same.
 */
export const toRolePickerOrder = (roles: readonly TOrganizationRole[]): TOrganizationRole[] =>
  [...roles].reverse();
