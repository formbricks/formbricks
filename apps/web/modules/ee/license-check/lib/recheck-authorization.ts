import "server-only";
import { AuthenticationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";

/**
 * Who may force a license recheck: organization owners and managers.
 *
 * ENG-1737 moved this off a role-name test. It used to deny the `member` role by name, which let
 * `billing` through — that role is neither an owner nor a manager, but it is also not a member, so
 * the negative test missed it. `organization.manage` is defined as exactly owner + manager, which is
 * what this action's own error message has always claimed.
 *
 * Membership is established separately from the capability so a caller outside the organization keeps
 * reporting as a non-member rather than as an insufficient one. It lives here, outside the action, so
 * it can be tested without the `authenticatedActionClient` wrapper.
 *
 * @throws AuthenticationError when the user holds no membership in the organization.
 * @throws OperationNotAllowedError when the user is a member but may not manage the organization.
 */
export const assertCanRecheckLicense = async (userId: string, organizationId: string): Promise<void> => {
  const actor = { type: "user", id: userId } as const;
  const organization = { type: "organization", id: organizationId } as const;

  if (!(await can(actor, "organization.read", organization))) {
    throw new AuthenticationError("User not a member of this organization");
  }

  if (!(await can(actor, "organization.manage", organization))) {
    throw new OperationNotAllowedError("Only owners and managers can recheck license");
  }
};
