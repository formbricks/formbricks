import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TMembership } from "@formbricks/types/memberships";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  problemBadRequest,
  problemConflict,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { requireRoleManagementEntitlement } from "@/modules/ee/role-management/lib/api-access";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { getOrganizationOwnerCount } from "@/modules/organization/settings/teams/lib/membership";
import type { TMemberUpdateBody } from "../schemas";
import { serializeMemberRole } from "../serializers";

export const LAST_OWNER_DETAIL = "You cannot demote the last owner of the organization";

/** Raised inside the demotion transaction, so the transaction rolls back and the route answers 409. */
class LastOwnerDemotionError extends Error {}

/**
 * Change the role, demoting an owner only while another active owner remains. The owner count and the
 * update are one Serializable transaction: read then act in two statements would let two owners demoting
 * each other concurrently both see "more than one owner", leaving none. Postgres aborts one of the two.
 *
 * The organization's owner memberships are locked first, in `userId` order, the same lock the data
 * retention members sweep takes before deactivating an owner (`deactivateDueMember`). Serializable alone
 * doesn't order this against that sweep, so a self-demotion racing the deactivation of the other owner could
 * leave no active owner.
 */
const applyRoleChange = (
  target: TMembership,
  body: TMemberUpdateBody
): Promise<TMembership | LastOwnerDemotionError> => {
  const { userId, organizationId } = target;
  if (target.role !== "owner" || body.role === "owner") {
    return updateMembership(userId, organizationId, body);
  }

  return prisma
    .$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT 1 FROM "Membership"
          WHERE "organizationId" = ${organizationId} AND "role" = 'owner'
          ORDER BY "userId"
          FOR UPDATE
        `;
        if ((await getOrganizationOwnerCount(organizationId, tx)) <= 1) throw new LastOwnerDemotionError();
        return updateMembership(userId, organizationId, body, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
    .catch((error: unknown) => {
      if (error instanceof LastOwnerDemotionError) return error;
      throw error;
    });
};

/**
 * `PATCH /api/internal/members/{userId}?organizationId=`: change a member's organization role.
 *
 * The caller must be a member with `organization.manage_access` (user management, per
 * `USER_MANAGEMENT_MINIMUM_ROLE`) and `organization.manage`. Managers may only assign the member role and
 * may not touch an owner; the billing role exists only on Formbricks Cloud; the last active owner can't be
 * demoted; and the role management licence applies. A missing member gets the same 403 as one in an
 * organization the caller can't see.
 */
export async function updateMemberRoleOperation({
  authentication,
  userId,
  organizationId,
  body,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  userId: string;
  organizationId: string;
  body: TMemberUpdateBody;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = `${userId}-${organizationId}`;
  }

  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);

  const callerMembership = await getMembershipByUserIdOrganizationId(actor.id, organizationId);
  if (!callerMembership) return problemForbidden(requestId, undefined, instance);

  // `organization.manage_access` *is* the user-management decision in the central vocabulary; SpiceDB maps
  // `USER_MANAGEMENT_MINIMUM_ROLE` onto it. `organization.manage` below is a different capability, also
  // required, so both stay. The caller is a member, so naming the reason reveals nothing new.
  if (!(await can(actor, "organization.manage_access", { type: "organization", id: organizationId }))) {
    return problemForbidden(requestId, "User management is not allowed for your role", instance);
  }

  const access = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  if (!IS_FORMBRICKS_CLOUD && body.role === "billing") {
    return problemBadRequest(requestId, "Billing role is not allowed", {
      instance,
      invalid_params: [{ name: "role", reason: "Billing role is not allowed" }],
    });
  }

  if (callerMembership.role === "manager" && body.role !== "member") {
    return problemForbidden(requestId, "Managers can only assign users to the member role", instance);
  }

  const target = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (callerMembership.role !== "owner" && target?.role === "owner") {
    return problemForbidden(requestId, "Only owners can change the role of an owner", instance);
  }

  const notEntitled = await requireRoleManagementEntitlement({ organizationId, requestId, instance });
  if (notEntitled) return notEntitled;

  if (!target) return problemForbidden(requestId, undefined, instance);
  if (auditLog) auditLog.oldObject = target;

  const result = await applyRoleChange(target, body);
  if (result instanceof LastOwnerDemotionError) {
    return problemConflict(requestId, LAST_OWNER_DETAIL, instance);
  }

  if (auditLog) auditLog.newObject = result;
  return successResponse(serializeMemberRole(result), { requestId });
}
