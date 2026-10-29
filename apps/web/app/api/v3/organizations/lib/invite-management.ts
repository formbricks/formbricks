import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { INVITE_DISABLED } from "@/lib/constants";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { sendInviteMemberEmail } from "@/modules/email";
import { deleteInvite, refreshInviteExpiration } from "@/modules/organization/settings/teams/lib/invite";
import {
  reserveInviteRateLimit,
  settleInviteRateLimit,
} from "@/modules/organization/settings/teams/lib/invite-rate-limit";
import { problemHiddenResource, requireV3UserManagement } from "./access";
import type { TV3InviteDeleteResource, TV3InviteResendResource } from "./members-schemas";

type TInviteParams = {
  organizationId: string;
  inviteId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

const INVITES_DISABLED_MESSAGE = "Invites are disabled on this instance.";
const OWNER_INVITE_MESSAGE = "Only an owner can manage an invite for the owner role.";

/**
 * The invite, only if it belongs to this organization: an id from another organization answers exactly
 * like one that does not exist, so a manager cannot probe other tenants' invites.
 */
const findOrganizationInvite = (organizationId: string, inviteId: string) =>
  prisma.invite.findFirst({
    where: { id: inviteId, organizationId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      expiresAt: true,
      creator: { select: { name: true } },
    },
  });

/**
 * Delete a pending invite.
 *
 * **Nothing is deleted unless `confirm` is `true`.** Without it the call runs every check and answers with a
 * `preview`. The invitee can no longer join with the link in their email. A manager cannot touch an invite
 * for the owner role.
 */
export async function deleteV3OrganizationInvite({
  organizationId,
  inviteId,
  confirm,
  authentication,
  requestId,
  instance,
  auditLog,
}: TInviteParams & { confirm?: boolean }): Promise<Response> {
  const log = logger.withContext({ requestId, organizationId });

  try {
    const access = await requireV3UserManagement(authentication, organizationId, requestId, instance);
    if (access instanceof Response) {
      log.warn({ statusCode: 403 }, "Invite deletion refused for this principal");
      return access;
    }

    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = inviteId;
    }

    const invite = await findOrganizationInvite(organizationId, inviteId);
    if (!invite) return problemHiddenResource(requestId, instance);
    if (access.role === "manager" && invite.role === "owner") {
      return problemForbidden(requestId, OWNER_INVITE_MESSAGE, instance);
    }

    const resource = (
      status: TV3InviteDeleteResource["status"],
      message: string
    ): TV3InviteDeleteResource => ({
      status,
      organizationId,
      inviteId,
      role: invite.role,
      message,
    });

    if (confirm !== true) {
      skipV3AuditLog(auditLog);
      return successResponse(
        resource(
          "preview",
          `Not deleted. This would delete a pending invite with the role ${invite.role}; its link stops working. Call again with confirm: true after the person approves.`
        ),
        { requestId, cache: "private, no-store" }
      );
    }

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);
    await deleteInvite(inviteId);

    if (auditLog) {
      auditLog.oldObject = { email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
    }

    log.info({ statusCode: 200 }, "Organization invite deleted");
    return successResponse(resource("deleted", "The invite was deleted."), {
      requestId,
      cache: "private, no-store",
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "organizations.invites.delete" });
  }
}

/**
 * Resend a pending (or expired) invite: the expiry is pushed seven days out and the email is sent again.
 * It reaches only an address the person already approved when it was invited, and is rate limited per
 * organization and per person like the first send, so it carries no `confirm`. Delivery is best-effort:
 * `emailSent: false` means the invite was refreshed but the email could not be sent.
 */
export async function resendV3OrganizationInvite({
  organizationId,
  inviteId,
  authentication,
  requestId,
  instance,
  auditLog,
}: TInviteParams): Promise<Response> {
  const log = logger.withContext({ requestId, organizationId });

  try {
    if (INVITE_DISABLED) {
      return problemForbidden(requestId, INVITES_DISABLED_MESSAGE, instance);
    }

    const access = await requireV3UserManagement(authentication, organizationId, requestId, instance);
    if (access instanceof Response) {
      log.warn({ statusCode: 403 }, "Invite resend refused for this principal");
      return access;
    }

    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = inviteId;
    }

    const invite = await findOrganizationInvite(organizationId, inviteId);
    if (!invite) return problemHiddenResource(requestId, instance);
    if (access.role === "manager" && invite.role === "owner") {
      return problemForbidden(requestId, OWNER_INVITE_MESSAGE, instance);
    }

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);
    const reservation = await reserveInviteRateLimit(organizationId, access.userId);

    let expiresAt: Date;
    try {
      ({ expiresAt } = await refreshInviteExpiration(inviteId));
    } catch (error) {
      await settleInviteRateLimit(reservation, 0);
      throw error;
    }
    await settleInviteRateLimit(reservation, 1);

    if (auditLog) {
      auditLog.oldObject = { expiresAt: invite.expiresAt };
      auditLog.newObject = { expiresAt };
    }

    let emailSent = false;
    try {
      emailSent = await sendInviteMemberEmail(
        inviteId,
        invite.email,
        invite.creator?.name ?? "",
        invite.name ?? "",
        organizationId
      );
    } catch (error) {
      log.error({ err: error }, "Failed to send invite email");
    }

    const resource: TV3InviteResendResource = {
      status: "resent",
      organizationId,
      inviteId,
      role: invite.role as TOrganizationRole,
      expiresAt: expiresAt.toISOString(),
      emailSent,
      message: emailSent ? "Invite resent." : "Invite refreshed, but the email could not be sent.",
    };
    log.info({ statusCode: 200 }, "Organization invite resent");
    return successResponse(resource, { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "organizations.invites.resend" });
  }
}
