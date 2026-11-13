import "server-only";
import { OrganizationRole } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { InvalidInputError, TooManyRequestsError, ValidationError } from "@formbricks/types/errors";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { requireUserManagementAccess } from "@/app/api/internal/lib/organization-access";
import type { TRequestContext } from "@/app/api/internal/lib/types";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { rateLimitedResponse } from "@/app/api/v3/lib/operation-rate-limit";
import {
  problemBadRequest,
  problemConflict,
  problemForbidden,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { can } from "@/lib/authorization";
import { INVITE_DISABLED, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { getUser } from "@/lib/user/service";
import { loggableError } from "@/lib/utils/loggable-error";
import { getBulkInvitePermission } from "@/modules/ee/license-check/lib/utils";
import {
  refuseRoleAssignment,
  requireRoleManagementEntitlement,
} from "@/modules/ee/role-management/lib/api-access";
import { getTeamsWhereUserIsAdmin } from "@/modules/ee/teams/lib/roles";
import { sendInviteMemberEmail } from "@/modules/email";
import { inviteUser } from "@/modules/organization/settings/teams/lib/invite";
import {
  type TBulkInviteResult,
  getInviteFailureReason,
} from "@/modules/organization/settings/teams/lib/invite-failure";
import {
  reserveInviteRateLimit,
  settleInviteRateLimit,
} from "@/modules/organization/settings/teams/lib/invite-rate-limit";
import type { TInviteBatchBody, TInviteCreateBody } from "../schemas";
import type { TCreatedInviteResource } from "../serializers";

export const INVITE_DISABLED_DETAIL = "Invite disabled";
export const BULK_INVITE_NOT_ALLOWED_DETAIL = "Bulk invite is not available on your current plan";
const TEAM_ADMIN_TEAMS_DETAIL = "Team admins can only add users to teams where they are admin";

/** The session user, with the name the invite email signs with, or the 401. */
async function requireInviter({ authentication, requestId, instance }: TRequestContext) {
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);
  const user = await getUser(actor.id);
  if (!user) return problemUnauthorized(requestId, "Session required", instance);
  return user;
}

/** Spend the invite budget for `recipients`, or the 429. Shared with the resend and onboarding invite paths. */
async function reserveInvites(
  { requestId, instance }: TRequestContext,
  organizationId: string,
  userId: string,
  recipients?: number
) {
  try {
    return await reserveInviteRateLimit(organizationId, userId, recipients);
  } catch (error) {
    if (error instanceof TooManyRequestsError) return rateLimitedResponse(error, { requestId, instance });
    throw error;
  }
}

/**
 * The team admin's narrower rules, which are policy about the request's content rather than capabilities:
 * they invite only Members, only into teams they administer, and into at least one.
 */
const refuseTeamAdminInvite = (
  adminTeamIds: ReadonlyArray<string>,
  body: TInviteCreateBody,
  { requestId, instance }: TRequestContext
): Response | null => {
  if (body.role !== "member") {
    return problemForbidden(requestId, "Team admins can only invite users as members", instance);
  }
  if (body.teamIds.some((id) => !adminTeamIds.includes(id))) {
    return problemForbidden(requestId, TEAM_ADMIN_TEAMS_DETAIL, instance);
  }
  if (body.teamIds.length === 0) {
    return problemUnprocessableContent(requestId, "Team admins must add invited users to at least one team", {
      instance,
    });
  }
  return null;
};

/**
 * The capability half of "may this person send this invite", through the central interface. Owners and
 * managers invite as the organization: the user-management floor, then `organization.manage`. A team admin
 * invites into their own teams: `team.manage` on each distinct named team, one at a time, stopping at the
 * first refusal, so the number of authorization decisions is bounded by the schema's team cap rather than
 * fanning out.
 */
async function refuseInviterCapability(
  context: TRequestContext,
  {
    isOrgOwnerOrManager,
    organizationId,
    teamIds,
    userId,
  }: { isOrgOwnerOrManager: boolean; organizationId: string; teamIds: ReadonlyArray<string>; userId: string }
): Promise<Response | null> {
  const { authentication, requestId, instance } = context;
  if (isOrgOwnerOrManager) {
    const access = await requireUserManagementAccess({ authentication, organizationId, requestId, instance });
    return access instanceof Response ? access : null;
  }

  const actor = { type: "user", id: userId } as const;
  for (const teamId of new Set(teamIds)) {
    if (!(await can(actor, "team.manage", { type: "team", id: teamId }))) {
      return problemForbidden(requestId, TEAM_ADMIN_TEAMS_DETAIL, instance);
    }
  }
  return null;
}

/**
 * An invite the organization's current state refuses: already invited or already a member (409), or teams
 * that repeat or aren't the organization's (422). The reason is the one the invite form maps to its message.
 */
const inviteRefusal = (error: unknown, { requestId, instance }: TRequestContext): Response | null => {
  if (error instanceof InvalidInputError) return problemConflict(requestId, error.message, instance);
  if (error instanceof ValidationError) {
    return problemUnprocessableContent(requestId, error.message, { instance });
  }
  return null;
};

/** Send one invite's email, best-effort: a failing SMTP must not strand the invite, which can be shared by link. */
async function sendInviteEmailBestEffort(
  invite: { inviteId: string; email: string; inviteeName: string; organizationId: string },
  inviter: { id: string; name: string | null },
  failureMessage: string
): Promise<void> {
  try {
    await sendInviteMemberEmail(
      invite.inviteId,
      invite.email,
      inviter.name ?? "",
      invite.inviteeName,
      invite.organizationId,
      inviter.id
    );
  } catch (error) {
    logger.error(loggableError(error), failureMessage);
  }
}

/**
 * Who may send this one invite, in the action's order: billing only on Cloud, a member of the organization,
 * then either an owner or manager (the floor, `organization.manage` and the role rules) or a team admin
 * (`team.manage` per team and their own rules), and the role management licence for anything but a
 * team-less Owner invite. `null` to go ahead.
 */
async function refuseSingleInvite(
  context: TRequestContext,
  { organizationId, userId, body }: { organizationId: string; userId: string; body: TInviteCreateBody }
): Promise<Response | null> {
  const { requestId, instance } = context;
  if (!IS_FORMBRICKS_CLOUD && body.role === OrganizationRole.billing) {
    return problemBadRequest(requestId, "Billing role is not allowed", {
      instance,
      invalid_params: [{ name: "role", reason: "Billing role is not allowed" }],
    });
  }

  const callerMembership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!callerMembership) return problemForbidden(requestId, undefined, instance);

  const isOrgOwnerOrManager = callerMembership.role === "owner" || callerMembership.role === "manager";
  // Owners and managers skip the team lookup: they invite as the organization.
  const adminTeamIds = isOrgOwnerOrManager ? [] : await getTeamsWhereUserIsAdmin(userId, organizationId);
  if (!isOrgOwnerOrManager && adminTeamIds.length === 0) {
    return problemForbidden(requestId, "Not authorized to invite members", instance);
  }

  const incapable = await refuseInviterCapability(context, {
    isOrgOwnerOrManager,
    organizationId,
    teamIds: body.teamIds,
    userId,
  });
  if (incapable) return incapable;

  // Owners and managers give roles by the one shared rule (C10); a team admin by their own.
  const refused = isOrgOwnerOrManager
    ? await refuseRoleAssignment({
        organizationId,
        assignerRole: callerMembership.role,
        roles: [body.role],
        requestId,
        instance,
      })
    : refuseTeamAdminInvite(adminTeamIds, body, context);
  if (refused) return refused;

  if (body.role === "owner" && body.teamIds.length === 0) return null;
  return requireRoleManagementEntitlement({ organizationId, requestId, instance });
}

/** Create the invite against one reserved recipient, handed back unless an invite was created. */
async function persistSingleInvite(
  context: TRequestContext,
  { organizationId, userId, body }: { organizationId: string; userId: string; body: TInviteCreateBody }
): Promise<Response | string> {
  const reservation = await reserveInvites(context, organizationId, userId);
  if (reservation instanceof Response) return reservation;

  let inviteId: string;
  try {
    inviteId = await inviteUser({
      organizationId,
      invitee: { email: body.email, name: body.name, role: body.role, teamIds: body.teamIds },
      currentUserId: userId,
    });
  } catch (error) {
    await settleInviteRateLimit(reservation, 0);
    const refused = inviteRefusal(error, context);
    if (refused) return refused;
    throw error;
  }
  await settleInviteRateLimit(reservation, inviteId ? 1 : 0);
  return inviteId;
}

/**
 * `POST /api/internal/invites?organizationId=`: invite one person. Owners and managers above the
 * user-management floor invite with any role the role rules let them give; a team admin invites Members
 * into teams they administer. Roles other than Owner, or any team, need the role management licence. Spends
 * one recipient of the shared invite budget, handed back if the invite isn't created. The email is
 * best-effort: the invite already exists and can be shared by link.
 */
export async function createInviteOperation({
  organizationId,
  body,
  ...context
}: TRequestContext & { organizationId: string; body: TInviteCreateBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  if (auditLog) auditLog.organizationId = organizationId;

  const user = await requireInviter(context);
  if (user instanceof Response) return user;

  if (INVITE_DISABLED) return problemForbidden(requestId, INVITE_DISABLED_DETAIL, instance);

  const refused = await refuseSingleInvite(context, { organizationId, userId: user.id, body });
  if (refused) return refused;

  const inviteId = await persistSingleInvite(context, { organizationId, userId: user.id, body });
  if (inviteId instanceof Response) return inviteId;

  if (auditLog) {
    auditLog.targetId = inviteId;
    auditLog.newObject = { email: body.email, name: body.name, role: body.role, teamIds: body.teamIds };
  }

  if (inviteId) {
    await sendInviteEmailBestEffort(
      { inviteId, email: body.email, inviteeName: body.name ?? "", organizationId },
      user,
      "Failed to send invite email"
    );
  }

  capturePostHogEvent(
    user.id,
    "team_member_invited",
    { organization_id: organizationId, invitee_role: body.role },
    { organizationId }
  );

  return successResponse<TCreatedInviteResource>({ id: inviteId }, { requestId, status: 201 });
}

/**
 * Who may send this batch: a member above the user-management floor with `organization.manage`, the
 * bulk-invite entitlement, every row's role by the role rules at once, and the role management licence
 * unless every row is a team-less Owner. `null` to go ahead.
 */
async function refuseBatch(
  context: TRequestContext,
  { organizationId, userId, body }: { organizationId: string; userId: string; body: TInviteBatchBody }
): Promise<Response | null> {
  const { authentication, requestId, instance } = context;
  const callerMembership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!callerMembership) return problemForbidden(requestId, undefined, instance);

  const access = await requireUserManagementAccess({ authentication, organizationId, requestId, instance });
  if (access instanceof Response) return access;

  // A paid feature: keeps high-volume invites behind the bulk-invite entitlement (Stripe on Cloud, the
  // licence on self-hosted), which mitigates invite spam.
  if (!(await getBulkInvitePermission(organizationId))) {
    return problemForbidden(requestId, BULK_INVITE_NOT_ALLOWED_DETAIL, instance);
  }

  const refused = await refuseRoleAssignment({
    organizationId,
    assignerRole: callerMembership.role,
    roles: body.invitees.map((invitee): TOrganizationRole => invitee.role),
    paramName: "invitees",
    requestId,
    instance,
  });
  if (refused) return refused;

  if (body.invitees.every((invitee) => invitee.role === "owner" && invitee.teamIds.length === 0)) return null;
  return requireRoleManagementEntitlement({ organizationId, requestId, instance });
}

/** Invite one row of a batch: its outcome, and its email when the invite was created. */
async function inviteRow(
  invitee: TInviteBatchBody["invitees"][number],
  organizationId: string,
  inviter: { id: string; name: string | null }
): Promise<TBulkInviteResult> {
  const email = invitee.email.toLowerCase();
  let inviteId: string;
  try {
    inviteId = await inviteUser({
      organizationId,
      invitee: { ...invitee, email },
      currentUserId: inviter.id,
    });
  } catch (error) {
    return { email, success: false, failureReason: getInviteFailureReason(error) };
  }
  if (!inviteId) return { email, success: false, failureReason: "unknown" };

  // Best-effort, as for a single invite: a failed send must not flip a created invite to failed.
  await sendInviteEmailBestEffort(
    { inviteId, email, inviteeName: invitee.name ?? "", organizationId },
    inviter,
    "Failed to send bulk invite email"
  );
  return { email, success: true };
}

/**
 * `POST /api/internal/invites/batches?organizationId=`: a CSV bulk invite, owners and managers above the
 * user-management floor only, behind the bulk-invite entitlement. Every row's role is checked up front, so
 * one row the caller may not give refuses the whole batch before anything is written. Each row is then
 * invited on its own and answers for itself: the response lists every row with `success` and, for a row
 * that wasn't invited, its `failureReason`. The batch reserves one recipient per row and is charged only
 * for the invites created.
 */
export async function createInviteBatchOperation({
  organizationId,
  body,
  ...context
}: TRequestContext & { organizationId: string; body: TInviteBatchBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  if (auditLog) auditLog.organizationId = organizationId;

  const user = await requireInviter(context);
  if (user instanceof Response) return user;

  if (INVITE_DISABLED) return problemForbidden(requestId, INVITE_DISABLED_DETAIL, instance);

  const refused = await refuseBatch(context, { organizationId, userId: user.id, body });
  if (refused) return refused;

  const { invitees } = body;
  const reservation = await reserveInvites(context, organizationId, user.id, invitees.length);
  if (reservation instanceof Response) return reservation;

  const results: TBulkInviteResult[] = [];
  try {
    // One row at a time, as the action did: no fan-out of concurrent writes and emails.
    for (const invitee of invitees) {
      results.push(await inviteRow(invitee, organizationId, user));
    }
  } finally {
    await settleInviteRateLimit(reservation, results.filter((result) => result.success).length);
  }
  const invitedEmails = results.filter((result) => result.success).map((result) => result.email);

  if (auditLog) {
    auditLog.newObject = {
      invitedCount: invitedEmails.length,
      totalCount: invitees.length,
      emails: invitedEmails,
    };
  }

  capturePostHogEvent(
    user.id,
    "team_members_bulk_invited",
    { organization_id: organizationId, invited_count: invitedEmails.length, total_count: invitees.length },
    { organizationId }
  );

  return successResponse<TBulkInviteResult[]>(results, { requestId });
}
