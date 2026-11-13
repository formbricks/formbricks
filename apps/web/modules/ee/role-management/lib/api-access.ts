import "server-only";
import { OperationNotAllowedError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { problemBadRequest, problemForbidden } from "@/app/api/v3/lib/response";
import {
  assertCanAssignRole,
  checkRoleManagementPermission,
} from "@/modules/ee/role-management/lib/permission";

export const ROLE_MANAGEMENT_NOT_ALLOWED_DETAIL = "Role management is not allowed for this organization";

/**
 * The role management licence (teams, and changing a member's or invitee's role) as an HTTP answer: `null`
 * to go ahead, or the 403 to answer with. Runs `checkRoleManagementPermission`, the same check the server
 * actions ran, so the entitlement rule stays in one place.
 *
 * Call it only after the caller is authorized, so a non-member never learns whether the organization holds
 * the entitlement. An organization that is gone by then gets the plain 403 a caller gets for one they can't
 * see.
 */
export async function requireRoleManagementEntitlement({
  organizationId,
  requestId,
  instance,
}: {
  organizationId: string;
  requestId: string;
  instance?: string;
}): Promise<Response | null> {
  try {
    await checkRoleManagementPermission(organizationId);
    return null;
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
    if (error instanceof OperationNotAllowedError) {
      return problemForbidden(requestId, ROLE_MANAGEMENT_NOT_ALLOWED_DETAIL, instance);
    }
    throw error;
  }
}

/**
 * The role rules (`assertCanAssignRole`: billing is Cloud-only, the Dashboard viewer role needs its plan,
 * managers give only the roles they may, and only owners change an owner) as an HTTP answer: `null` to go
 * ahead, a 400 naming `paramName` (the body field the roles came from, `role` by default) for a role this
 * instance doesn't have, or a 403 with the rule's reason. A bulk invite passes every row's role at once.
 */
export async function refuseRoleAssignment({
  organizationId,
  assignerRole,
  roles,
  paramName = "role",
  targetCurrentRole,
  requestId,
  instance,
}: {
  organizationId: string;
  assignerRole: TOrganizationRole;
  roles: ReadonlyArray<TOrganizationRole>;
  paramName?: string;
  targetCurrentRole?: TOrganizationRole | null;
  requestId: string;
  instance?: string;
}): Promise<Response | null> {
  try {
    await assertCanAssignRole({ organizationId, assignerRole, roles, targetCurrentRole });
    return null;
  } catch (error) {
    if (error instanceof ValidationError) {
      return problemBadRequest(requestId, error.message, {
        instance,
        invalid_params: [{ name: paramName, reason: error.message }],
      });
    }
    if (error instanceof OperationNotAllowedError)
      return problemForbidden(requestId, error.message, instance);
    throw error;
  }
}
