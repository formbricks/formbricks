import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { paginateByIdCursor } from "@/app/api/v3/lib/cursor-pagination";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { parseV3Body } from "@/app/api/v3/lib/parse-body";
import {
  problemBadRequest,
  problemConflict,
  problemForbidden,
  problemUnauthorized,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/lib/permission";
import {
  deleteMembership,
  getOrganizationOwnerCount,
} from "@/modules/organization/settings/teams/lib/membership";
import { getMemberDirectory } from "@/modules/shell/organization/lib/member-directory";
import type { TMemberRow } from "@/modules/shell/organization/lib/member-rows";
import { isOrganizationManagerRole, problemHiddenResource, requireV3UserManagement } from "./access";
import {
  type TV3MemberListMeta,
  type TV3MemberListQuery,
  type TV3MemberRemoveResource,
  type TV3MemberRoleUpdateResource,
  type TV3MemberRow,
  ZV3MemberRoleUpdateBody,
} from "./members-schemas";

type TBaseParams = {
  organizationId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

type TMutationParams = TBaseParams & { userId: string; auditLog?: TV3AuditLog };

const MANAGER_ROLE_MESSAGE = "A manager can only assign the member role.";
const OWNER_ROLE_MESSAGE = "Only an owner can change the role of an owner.";
const OWNER_REMOVE_MESSAGE = "Only an owner can remove an owner.";
const OWN_ROLE_MESSAGE = "You cannot change your own role.";
const OWN_REMOVAL_MESSAGE =
  "You cannot remove yourself. Leaving an organization is something the person does in the app.";
const LAST_OWNER_DEMOTE_MESSAGE = "The last owner of the organization cannot be demoted.";
const LAST_OWNER_REMOVE_MESSAGE = "The last owner of the organization cannot be removed.";
const OWNER_RACE_MESSAGE = "The organization's owners changed at the same moment. Try again.";
const ROLE_MANAGEMENT_UNAVAILABLE_MESSAGE =
  "Changing a member's role is not available on this organization's plan.";

/** The access ladder `lowersAccess` is judged on. A finance seat (`billing`) sits below everyone. */
const ROLE_RANK: Record<TOrganizationRole, number> = { owner: 3, manager: 2, member: 1, billing: 0 };

/** `InvalidInputError` carries this module's own fixed strings (last owner, cursor): relay as 409. */
const conflictFrom = (error: unknown, requestId: string, instance: string): Response | null =>
  error instanceof InvalidInputError ? problemConflict(requestId, error.message, instance) : null;

const serializeMemberRow = (row: TMemberRow, includeSensitive: boolean): TV3MemberRow => ({
  kind: row.kind,
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  status: row.status,
  twoFactorEnabled: row.twoFactorEnabled,
  teamNames: includeSensitive ? row.teamNames : null,
  invitedAt: row.invitedAt ? row.invitedAt.toISOString() : null,
});

/**
 * List the people of an organization and its pending invites, for any signed-in member except the billing
 * role (the same readers the Members page had). Two-factor state and team names are security-relevant, so
 * they are loaded and returned for owners and managers only. API keys are refused: they carry no person.
 *
 * Rows are ordered by id and paged with an opaque cursor; `meta.totalCount` is exact up to the directory's
 * own cap, past which it is a lower bound (`gte`).
 */
export async function listV3OrganizationMembers({
  organizationId,
  query,
  authentication,
  requestId,
  instance,
}: TBaseParams & { query: TV3MemberListQuery }): Promise<Response> {
  const log = logger.withContext({ requestId, organizationId });

  try {
    if (!authentication) {
      return problemUnauthorized(requestId, "Not authenticated", instance);
    }
    if (!("user" in authentication) || !authentication.user?.id) {
      return problemForbidden(requestId, "Only a signed-in person can list organization members.", instance);
    }

    const actor = { type: "user", id: authentication.user.id } as const;
    const resource = { type: "organization", id: organizationId } as const;
    const [canRead, membership] = await Promise.all([
      can(actor, "organization.read_access", resource),
      getMembershipByUserIdOrganizationId(actor.id, organizationId),
    ]);
    if (!canRead || !membership) return problemHiddenResource(requestId, instance);

    const includeSensitive = isOrganizationManagerRole(membership.role);
    const directory = await getMemberDirectory(organizationId, includeSensitive);
    const rows = query.kind ? directory.rows.filter((row) => row.kind === query.kind) : directory.rows;

    let page: TMemberRow[];
    let nextCursor: string | null;
    try {
      ({ page, nextCursor } = paginateByIdCursor(rows, { limit: query.limit, cursor: query.cursor }));
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return problemBadRequest(requestId, error.message, {
          invalid_params: [{ name: "cursor", reason: error.message }],
          instance,
        });
      }
      throw error;
    }

    const meta: TV3MemberListMeta = {
      limit: query.limit,
      nextCursor,
      totalCount: rows.length,
      totalCountRelation: directory.isTruncated ? "gte" : "eq",
    };
    return successListResponse(
      page.map((row) => serializeMemberRow(row, includeSensitive)),
      meta,
      { requestId, cache: "private, no-store" }
    );
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "organizations.members.list" });
  }
}

/**
 * Change a member's role to `member` or `manager`.
 *
 * **Nothing changes unless `confirm` is `true`.** Without it the call runs every check and answers with a
 * `preview` (`lowersAccess` says whether the person would lose access), so a model cannot re-role anyone on
 * its own say-so. The rules are the old members table's: not yourself, a manager only assigns `member` and
 * never touches an owner, the last owner stays, and the organization's plan must include role management.
 * An agent never grants `owner` or `billing`. A change to the role the person already has is a no-op.
 */
export async function updateV3OrganizationMemberRole({
  organizationId,
  userId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TMutationParams & { body: unknown }): Promise<Response> {
  const log = logger.withContext({ requestId, organizationId });

  try {
    const parsed = parseV3Body(ZV3MemberRoleUpdateBody, body, requestId, instance);
    if (!parsed.ok) return parsed.response;
    const { role, confirm } = parsed.data;

    const access = await requireV3UserManagement(authentication, organizationId, requestId, instance);
    if (access instanceof Response) {
      log.warn({ statusCode: 403 }, "Member role change refused for this principal");
      return access;
    }

    // Trustworthy only now that the caller is known to manage this organization.
    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = `${userId}-${organizationId}`;
    }

    if (access.role === "manager" && role !== "member") {
      return problemForbidden(requestId, MANAGER_ROLE_MESSAGE, instance);
    }
    if (userId === access.userId) {
      return problemForbidden(requestId, OWN_ROLE_MESSAGE, instance);
    }

    const target = await getMembershipByUserIdOrganizationId(userId, organizationId);
    if (!target) return problemHiddenResource(requestId, instance);
    if (access.role !== "owner" && target.role === "owner") {
      return problemForbidden(requestId, OWNER_ROLE_MESSAGE, instance);
    }

    try {
      await checkRoleManagementPermission(organizationId);
    } catch (error) {
      if (error instanceof OperationNotAllowedError) {
        return problemForbidden(requestId, ROLE_MANAGEMENT_UNAVAILABLE_MESSAGE, instance);
      }
      throw error;
    }

    const lowersAccess = ROLE_RANK[role] < ROLE_RANK[target.role];
    const resource = (
      status: TV3MemberRoleUpdateResource["status"],
      message: string
    ): TV3MemberRoleUpdateResource => ({
      status,
      organizationId,
      userId,
      previousRole: target.role,
      role,
      lowersAccess,
      message,
    });

    if (target.role === role) {
      skipV3AuditLog(auditLog);
      return successResponse(resource("unchanged", `The member already has the role ${role}.`), {
        requestId,
        cache: "private, no-store",
      });
    }

    const isDemotingOwner = target.role === "owner";

    if (confirm !== true) {
      // A preview changes nothing, so there is nothing to audit.
      skipV3AuditLog(auditLog);

      // The same last-owner rule the confirmed call enforces, so a preview never promises a change that
      // would answer 409.
      if (isDemotingOwner && (await getOrganizationOwnerCount(organizationId)) <= 1) {
        return problemConflict(requestId, LAST_OWNER_DEMOTE_MESSAGE, instance);
      }

      return successResponse(
        resource(
          "preview",
          `Not changed. This would change the member's role from ${target.role} to ${role}${lowersAccess ? ", which lowers their access" : ""}. Call again with confirm: true after the person approves.`
        ),
        { requestId, cache: "private, no-store" }
      );
    }

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);

    // Demoting an owner reads the owner count and writes in one Serializable transaction: two owners
    // demoting each other concurrently would otherwise both read "more than one owner" and leave none.
    try {
      if (isDemotingOwner) {
        await prisma.$transaction(
          async (tx) => {
            if ((await getOrganizationOwnerCount(organizationId, tx)) <= 1) {
              throw new InvalidInputError(LAST_OWNER_DEMOTE_MESSAGE);
            }
            return updateMembership(userId, organizationId, { role }, tx);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } else {
        await updateMembership(userId, organizationId, { role });
      }
    } catch (error) {
      const conflict = conflictFrom(error, requestId, instance);
      if (conflict) return conflict;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PrismaErrorType.TransactionConflict
      ) {
        return problemConflict(requestId, OWNER_RACE_MESSAGE, instance);
      }
      throw error;
    }

    if (auditLog) {
      auditLog.oldObject = { role: target.role };
      auditLog.newObject = { role };
    }

    log.info({ statusCode: 200, role }, "Organization member role changed");
    return successResponse(resource("updated", `The member's role is now ${role}.`), {
      requestId,
      cache: "private, no-store",
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "organizations.members.update" });
  }
}

/**
 * Remove a member from an organization, with their team memberships.
 *
 * **Nothing is removed unless `confirm` is `true`.** Without it the call runs every check and answers with a
 * `preview`. Nobody removes themselves (leaving is the person's own action in the app), a manager never
 * removes an owner, and the last owner stays.
 */
export async function removeV3OrganizationMember({
  organizationId,
  userId,
  confirm,
  authentication,
  requestId,
  instance,
  auditLog,
}: TMutationParams & { confirm?: boolean }): Promise<Response> {
  const log = logger.withContext({ requestId, organizationId });

  try {
    const access = await requireV3UserManagement(authentication, organizationId, requestId, instance);
    if (access instanceof Response) {
      log.warn({ statusCode: 403 }, "Member removal refused for this principal");
      return access;
    }

    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = `${userId}-${organizationId}`;
    }

    if (userId === access.userId) {
      return problemForbidden(requestId, OWN_REMOVAL_MESSAGE, instance);
    }

    const target = await getMembershipByUserIdOrganizationId(userId, organizationId);
    if (!target) return problemHiddenResource(requestId, instance);
    if (access.role === "manager" && target.role === "owner") {
      return problemForbidden(requestId, OWNER_REMOVE_MESSAGE, instance);
    }

    if (target.role === "owner" && (await getOrganizationOwnerCount(organizationId)) <= 1) {
      return problemConflict(requestId, LAST_OWNER_REMOVE_MESSAGE, instance);
    }

    const resource = (
      status: TV3MemberRemoveResource["status"],
      message: string
    ): TV3MemberRemoveResource => ({
      status,
      organizationId,
      userId,
      role: target.role,
      message,
    });

    if (confirm !== true) {
      skipV3AuditLog(auditLog);
      return successResponse(
        resource(
          "preview",
          `Not removed. This would remove a member with the role ${target.role} and their team memberships from the organization. Call again with confirm: true after the person approves.`
        ),
        { requestId, cache: "private, no-store" }
      );
    }

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);
    await deleteMembership(userId, organizationId);

    if (auditLog) {
      auditLog.oldObject = target;
    }

    log.info({ statusCode: 200 }, "Organization member removed");
    return successResponse(resource("removed", "The member was removed from the organization."), {
      requestId,
      cache: "private, no-store",
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "organizations.members.remove" });
  }
}
