import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { parseV3Body } from "@/app/api/v3/lib/parse-body";
import { problemConflict, problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { INVITE_DISABLED } from "@/lib/constants";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/lib/permission";
import { sendInviteMemberEmail } from "@/modules/email";
import { assertInviteIsNew, inviteUser } from "@/modules/organization/settings/teams/lib/invite";
import {
  reserveInviteRateLimit,
  settleInviteRateLimit,
} from "@/modules/organization/settings/teams/lib/invite-rate-limit";
import { problemHiddenResource, requireV3OrganizationManager, requireV3UserManagement } from "./access";
import {
  type TV3InviteMemberResource,
  type TV3OrganizationResource,
  ZV3InviteMemberBody,
  ZV3OrganizationUpdateBody,
} from "./schemas";

type TOrganizationOperationParams = {
  organizationId: string;
  body: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

const INVITES_DISABLED_MESSAGE = "Invites are disabled on this instance.";
const MANAGER_INVITE_MESSAGE = "Only an organization owner can invite someone as a manager.";
const ROLE_MANAGEMENT_UNAVAILABLE_MESSAGE =
  "Inviting a member with a role is not available on this organization's plan.";

/** The minimal DTO a rename answers with, shared by the changed and the unchanged answer. */
export const serializeV3Organization = (
  organization: Readonly<{ id: string; name: string; updatedAt: Date }>
): TV3OrganizationResource => ({
  id: organization.id,
  name: organization.name,
  updatedAt: organization.updatedAt.toISOString(),
});

/** `inviteUser`'s own fixed strings (the invite or membership already exists) answer 409. */
const conflictFromInvite = (error: unknown, requestId: string, instance: string): Response | null =>
  error instanceof InvalidInputError ? problemConflict(requestId, error.message, instance) : null;

/**
 * Rename an organization. Owner or manager, as a signed-in user. Authorization is enforced here, not by a
 * route wrapper, so the MCP tool that calls this directly gets the same answer.
 */
export async function updateV3Organization({
  organizationId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TOrganizationOperationParams): Promise<Response> {
  const log = logger.withContext({ requestId, organizationId });

  try {
    const parsed = parseV3Body(ZV3OrganizationUpdateBody, body, requestId, instance);
    if (!parsed.ok) return parsed.response;

    const access = await requireV3OrganizationManager(authentication, organizationId, requestId, instance);
    if (access instanceof Response) {
      log.warn({ statusCode: 403 }, "Organization rename refused for this principal");
      return access;
    }

    // Trustworthy only now that the caller is known to manage this organization.
    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = organizationId;
    }

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);

    const previous = await getOrganization(organizationId);
    if (!previous) {
      return problemHiddenResource(requestId, instance);
    }

    if (previous.name === parsed.data.name) {
      skipV3AuditLog(auditLog);
      return successResponse(serializeV3Organization(previous), { requestId, cache: "private, no-store" });
    }

    const updated = await updateOrganization(organizationId, { name: parsed.data.name });

    if (auditLog) {
      auditLog.oldObject = { name: previous.name };
      auditLog.newObject = { name: updated.name };
    }

    log.info({ statusCode: 200 }, "Organization renamed");
    return successResponse(serializeV3Organization(updated), { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "organizations.update" });
  }
}

/**
 * Invite a person to an organization as a member or manager.
 *
 * **Nothing is sent unless `confirm` is `true`.** Without it the call runs every check an invite would
 * face and answers with a `preview` of who would be invited with which role, writing and mailing nothing,
 * so a model cannot invite anyone on its own say-so. Roles are the ones the old invite form allowed the
 * caller: an owner may invite a member or a manager, a manager only a member; `owner` and `billing` are
 * not grantable here at all.
 */
export async function inviteV3OrganizationMember({
  organizationId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TOrganizationOperationParams): Promise<Response> {
  const log = logger.withContext({ requestId, organizationId });

  try {
    const parsed = parseV3Body(ZV3InviteMemberBody, body, requestId, instance);
    if (!parsed.ok) return parsed.response;
    const { confirm, ...invitee } = parsed.data;

    if (INVITE_DISABLED) {
      return problemForbidden(requestId, INVITES_DISABLED_MESSAGE, instance);
    }

    const access = await requireV3UserManagement(authentication, organizationId, requestId, instance);
    if (access instanceof Response) {
      log.warn({ statusCode: 403 }, "Invite refused for this principal");
      return access;
    }

    if (auditLog) {
      auditLog.organizationId = organizationId;
    }

    if (access.role === "manager" && invitee.role !== "member") {
      return problemForbidden(requestId, MANAGER_INVITE_MESSAGE, instance);
    }

    try {
      await checkRoleManagementPermission(organizationId);
    } catch (error) {
      if (error instanceof OperationNotAllowedError) {
        return problemForbidden(requestId, ROLE_MANAGEMENT_UNAVAILABLE_MESSAGE, instance);
      }
      throw error;
    }

    if (confirm !== true) {
      // A preview changes nothing, so there is nothing to audit.
      skipV3AuditLog(auditLog);

      // The same preconditions the confirmed call hits (`inviteUser` runs the same function), so a preview
      // never promises an invite that would answer 409. Nothing is reserved, written or mailed.
      try {
        await assertInviteIsNew({ email: invitee.email, organizationId });
      } catch (error) {
        const conflict = conflictFromInvite(error, requestId, instance);
        if (conflict) return conflict;
        throw error;
      }

      const preview: TV3InviteMemberResource = {
        status: "preview",
        organizationId,
        ...invitee,
        message: `Not sent. This would invite ${invitee.email} as ${invitee.role}. Call again with confirm: true after the person approves.`,
      };
      return successResponse(preview, { requestId, cache: "private, no-store" });
    }

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);
    const reservation = await reserveInviteRateLimit(organizationId, access.userId);

    let inviteId: string;
    try {
      inviteId = await inviteUser({
        organizationId,
        invitee: { ...invitee, teamIds: [] },
        currentUserId: access.userId,
      });
    } catch (error) {
      await settleInviteRateLimit(reservation, 0);
      // The same preconditions as the preview, answered as 409 (a concurrent invite can also win the race).
      const conflict = conflictFromInvite(error, requestId, instance);
      if (conflict) return conflict;
      throw error;
    }
    await settleInviteRateLimit(reservation, 1);

    if (auditLog) {
      auditLog.targetId = inviteId;
      auditLog.newObject = { ...invitee, teamIds: [] };
    }

    // Delivery is best-effort: the invite is stored and can be resent, so a broken SMTP setup must not
    // turn a created invite into an error the person would then retry into "Invite already exists".
    let emailSent = false;
    try {
      emailSent = await sendInviteMemberEmail(
        inviteId,
        invitee.email,
        (authentication && "user" in authentication ? authentication.user.name : null) ?? "",
        invitee.name,
        organizationId
      );
    } catch (error) {
      log.error({ err: error }, "Failed to send invite email");
    }

    capturePostHogEvent(
      access.userId,
      "team_member_invited",
      { organization_id: organizationId, invitee_role: invitee.role },
      { organizationId }
    );

    const resource: TV3InviteMemberResource = {
      status: "invited",
      organizationId,
      ...invitee,
      inviteId,
      emailSent,
      message: emailSent ? "Invite sent." : "Invite created, but the email could not be sent.",
    };
    log.info({ statusCode: 200, role: invitee.role }, "Organization member invited");
    return successResponse(resource, { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "organizations.invite" });
  }
}
