import "server-only";
import { prisma } from "@formbricks/database";
import { TooManyRequestsError } from "@formbricks/types/errors";
import {
  requireOrgActionAccess,
  requireUserManagementAccess,
} from "@/app/api/internal/lib/organization-access";
import { forbidOnRefusal, refusalResponse } from "@/app/api/internal/lib/refusal";
import type { TRequestContext } from "@/app/api/internal/lib/types";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { applyRateLimitOrRespond, rateLimitedResponse } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { INVITE_DISABLED } from "@/lib/constants";
import { createInviteToken } from "@/lib/jwt";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { canManageUsers } from "@/lib/membership/user-management";
import { getInvite } from "@/lib/utils/services";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  refuseRoleAssignment,
  requireRoleManagementEntitlement,
} from "@/modules/ee/role-management/lib/api-access";
import { updateInvite } from "@/modules/ee/role-management/lib/invite";
import { sendInviteMemberEmail } from "@/modules/email";
import {
  type TInviteWriteScope,
  deleteInvite,
  getInvite as getInviteAuditSnapshot,
  refreshInviteExpiration,
  resendInvite,
} from "@/modules/organization/settings/teams/lib/invite";
import {
  reserveInviteRateLimit,
  settleInviteRateLimit,
} from "@/modules/organization/settings/teams/lib/invite-rate-limit";
import type { TInviteUpdateBody } from "../schemas";
import { type TInviteShareLinkResource, serializeInviteRole } from "../serializers";

export const INVITES_DISABLED_DETAIL = "Invite are disabled";

/**
 * `PATCH /api/internal/invites/{inviteId}`: change the role a pending invite grants. The organization is
 * read off the invite. The caller must be a member above the user-management floor (`canManageUsers`) with
 * `organization.manage`; the role rules are `assertCanAssignRole`'s, as for a member's role; only an owner
 * may change an owner's invite (ENG-6812); and the role management licence applies. A missing invite gets
 * the same 403 as one in an organization the caller can't see.
 */
export async function updateInviteOperation({
  authentication,
  inviteId,
  body,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  inviteId: string;
  body: TInviteUpdateBody;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  if (auditLog) auditLog.targetId = inviteId;

  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);

  const invite = await getInvite(inviteId);
  if (!invite) return problemForbidden(requestId, undefined, instance);
  const { organizationId } = invite;
  if (auditLog) auditLog.organizationId = organizationId;

  const callerMembership = await getMembershipByUserIdOrganizationId(actor.id, organizationId);
  if (!callerMembership) return problemForbidden(requestId, undefined, instance);

  // The user-management floor and `organization.manage` are separate capabilities, both required, as on
  // a member's role. The floor answers first, with its reason: the caller is a member, so naming it
  // reveals nothing.
  const [mayManageUsers, access] = await Promise.all([
    canManageUsers(actor.id, organizationId),
    requireOrgActionAccess({
      authentication,
      organizationId,
      action: "organization.manage",
      requestId,
      instance,
    }),
  ]);
  if (!mayManageUsers) {
    return problemForbidden(requestId, "User management is not allowed for your role", instance);
  }
  if (access instanceof Response) return access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  const refused = await refuseRoleAssignment({
    organizationId,
    assignerRole: callerMembership.role,
    roles: [body.role],
    requestId,
    instance,
  });
  if (refused) return refused;

  const notEntitled = await requireRoleManagementEntitlement({ organizationId, requestId, instance });
  if (notEntitled) return notEntitled;

  const before = await getInviteAuditSnapshot(inviteId);
  // Scoped in the write's own `WHERE`, so an invite promoted to owner after the checks above is not touched
  // either. One deleted since it was read gets the same 403 as a missing invite.
  const writeRefused = await forbidOnRefusal(
    () => updateInvite(inviteId, body, { allowOwnerInvite: callerMembership.role === "owner" }),
    requestId,
    instance
  );
  if (writeRefused) return writeRefused;

  if (auditLog) {
    auditLog.oldObject = { ...before };
    // Built from the write rather than re-read: `getInvite` is request-cached, so a second read here
    // would return the snapshot from before the update.
    auditLog.newObject = { ...before, ...body };
  }
  return successResponse(serializeInviteRole(inviteId, body.role), { requestId });
}

/**
 * What the caller may do to this organization's pending invites: an owner's invite is an owner's to change
 * (ENG-6812), as an owner's membership is kept from managers. Read after the authorization checks, so a
 * non-member never reaches it; `null` for a caller who is no longer a member by then.
 */
const getCallerInviteScope = async (
  userId: string,
  organizationId: string
): Promise<TInviteWriteScope | null> => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  return membership ? { allowOwnerInvite: membership.role === "owner" } : null;
};

/**
 * Authorize a write to one pending invite, as the invite server actions did: the organization is read off
 * the invite and named in the audit entry before any check can refuse; then the user-management floor,
 * `organization.manage` and the organization's state-mutation budget; then the caller's invite scope. A
 * missing invite gets the same 403 as one in an organization the caller can't see.
 */
async function requireInviteWrite(
  context: TRequestContext,
  inviteId: string,
  /** The organization the caller named, which must be the invite's own (the resend action's check). */
  expectedOrganizationId?: string
): Promise<Response | { organizationId: string; userId: string; scope: TInviteWriteScope }> {
  const { authentication, requestId, instance, auditLog } = context;
  if (auditLog) auditLog.targetId = inviteId;

  const invite = await getInvite(inviteId);
  if (!invite) return problemForbidden(requestId, undefined, instance);
  if (expectedOrganizationId !== undefined && invite.organizationId !== expectedOrganizationId) {
    return problemForbidden(requestId, undefined, instance);
  }
  const { organizationId } = invite;
  if (auditLog) auditLog.organizationId = organizationId;

  const access = await requireUserManagementAccess({ authentication, organizationId, requestId, instance });
  if (access instanceof Response) return access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  const scope = await getCallerInviteScope(access.userId, organizationId);
  if (!scope) return problemForbidden(requestId, undefined, instance);
  return { organizationId, userId: access.userId, scope };
}

/** `DELETE /api/internal/invites/{inviteId}`: withdraw a pending invite. Only an owner withdraws an owner's. */
export async function deleteInviteOperation({
  inviteId,
  ...context
}: TRequestContext & { inviteId: string }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const access = await requireInviteWrite(context, inviteId);
  if (access instanceof Response) return access;

  if (auditLog) auditLog.oldObject = { ...(await getInviteAuditSnapshot(inviteId)) };

  const refused = await forbidOnRefusal(() => deleteInvite(inviteId, access.scope), requestId, instance);
  if (refused) return refused;
  return noContentResponse({ requestId });
}

/**
 * `POST /api/internal/invites/{inviteId}/share-links`: a new link to a pending invite, to share by hand. The
 * invite's expiry restarts at seven days, and the link is valid as long. Only an owner re-links an owner's.
 */
export async function createInviteShareLinkOperation({
  inviteId,
  ...context
}: TRequestContext & { inviteId: string }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const access = await requireInviteWrite(context, inviteId);
  if (access instanceof Response) return access;

  const oldInvite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: { email: true, expiresAt: true },
  });
  if (!oldInvite) return problemForbidden(requestId, undefined, instance);

  let updatedInvite: Awaited<ReturnType<typeof refreshInviteExpiration>>;
  try {
    updatedInvite = await refreshInviteExpiration(inviteId, access.scope);
  } catch (error) {
    const refused = refusalResponse(error, requestId, instance);
    if (refused) return refused;
    throw error;
  }

  if (auditLog) {
    auditLog.oldObject = { expiresAt: oldInvite.expiresAt };
    auditLog.newObject = { expiresAt: updatedInvite.expiresAt };
  }

  const inviteToken = createInviteToken(inviteId, updatedInvite.email, { expiresIn: "7d" });
  return successResponse<TInviteShareLinkResource>(
    { inviteToken: encodeURIComponent(inviteToken) },
    { requestId, status: 201 }
  );
}

/**
 * `POST /api/internal/invites/{inviteId}/emails?organizationId=`: send the invite email again, restarting
 * the invite's seven days. Spends one recipient of the shared invite budget, handed back if the invite can't
 * be refreshed. Only an owner resends an owner's invite. The email is sent before the route answers, and a
 * failed send fails the request, as the action it replaces did.
 */
export async function resendInviteOperation({
  inviteId,
  organizationId,
  ...context
}: TRequestContext & { inviteId: string; organizationId: string }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  if (auditLog) {
    auditLog.targetId = inviteId;
    auditLog.organizationId = organizationId;
  }
  if (INVITE_DISABLED) return problemForbidden(requestId, INVITES_DISABLED_DETAIL, instance);

  const access = await requireInviteWrite(context, inviteId, organizationId);
  if (access instanceof Response) return access;

  let reservation: Awaited<ReturnType<typeof reserveInviteRateLimit>>;
  try {
    reservation = await reserveInviteRateLimit(organizationId, access.userId);
  } catch (error) {
    if (error instanceof TooManyRequestsError) return rateLimitedResponse(error, { requestId, instance });
    throw error;
  }

  let invite: Awaited<ReturnType<typeof getInviteAuditSnapshot>>;
  let updatedInvite: Awaited<ReturnType<typeof resendInvite>>;
  try {
    invite = await getInviteAuditSnapshot(inviteId);
    updatedInvite = await resendInvite(inviteId, access.scope);
  } catch (error) {
    await settleInviteRateLimit(reservation, 0);
    const refused = refusalResponse(error, requestId, instance);
    if (refused) return refused;
    throw error;
  }
  await settleInviteRateLimit(reservation, 1);

  if (auditLog) {
    auditLog.oldObject = { ...invite };
    auditLog.newObject = updatedInvite;
  }
  await sendInviteMemberEmail(
    inviteId,
    updatedInvite.email,
    invite?.creator?.name ?? "",
    updatedInvite.name ?? "",
    organizationId,
    access.userId
  );

  return noContentResponse({ requestId });
}
