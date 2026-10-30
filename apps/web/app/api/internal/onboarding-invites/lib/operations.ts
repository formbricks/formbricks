import "server-only";
import { logger } from "@formbricks/logger";
import { AuthorizationError, InvalidInputError, TooManyRequestsError } from "@formbricks/types/errors";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { rateLimitedResponse } from "@/app/api/v3/lib/operation-rate-limit";
import {
  problemBadRequest,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { INVITE_DISABLED } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { sendInviteMemberEmail } from "@/modules/email";
import {
  reserveInviteRateLimit,
  settleInviteRateLimit,
} from "@/modules/organization/settings/teams/lib/invite-rate-limit";
import { checkSetupInviteAuthorization } from "@/modules/setup/organization/[organizationId]/invite/lib/authorization";
import { inviteUser } from "@/modules/setup/organization/[organizationId]/invite/lib/invite";
import type { TOnboardingInviteBody } from "../schemas";

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/**
 * `POST /api/internal/onboarding-invites`: invite a teammate from the onboarding screen. Owner-only — see
 * `SETUP_INVITE_ACTION` for why this path is narrower than the organization settings invite. Shares one
 * recipient-counted budget with the settings, bulk and resend invite paths.
 */
export async function createOnboardingInviteOperation({
  body,
  ...context
}: TRequestContext & { body: TOnboardingInviteBody }): Promise<Response> {
  const { authentication, requestId, instance, auditLog } = context;
  if (auditLog) auditLog.organizationId = body.organizationId;

  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);
  const user = await getUser(actor.id);
  if (!user) return problemUnauthorized(requestId, "Session required", instance);

  if (INVITE_DISABLED) return problemForbidden(requestId, "Invite disabled", instance);

  try {
    await checkSetupInviteAuthorization(user.id, body.organizationId);
  } catch (error) {
    if (error instanceof AuthorizationError) return problemForbidden(requestId, undefined, instance);
    throw error;
  }

  let reservation: Awaited<ReturnType<typeof reserveInviteRateLimit>>;
  try {
    reservation = await reserveInviteRateLimit(body.organizationId, user.id);
  } catch (error) {
    if (error instanceof TooManyRequestsError) return rateLimitedResponse(error, { requestId, instance });
    throw error;
  }

  let inviteId: string;
  try {
    inviteId = await inviteUser({
      organizationId: body.organizationId,
      invitee: { email: body.email, name: body.name },
      currentUserId: user.id,
    });
  } catch (error) {
    await settleInviteRateLimit(reservation, 0);
    // "Invite already exists", "User is already a member of this organization": the form shows them.
    if (error instanceof InvalidInputError) return problemBadRequest(requestId, error.message, { instance });
    throw error;
  }
  await settleInviteRateLimit(reservation, 1);

  // Best-effort, like the other invite paths: the invite already exists and can be shared by link, so a
  // failed or rate-limited email must not strand it behind "Invite already exists" on a retry.
  try {
    await sendInviteMemberEmail(inviteId, body.email, user.name, "", body.organizationId);
  } catch (error) {
    logger.error({ err: error }, "Failed to send onboarding invite email");
  }

  if (auditLog) {
    auditLog.targetId = inviteId;
    auditLog.newObject = { invitedUserId: inviteId, email: body.email, name: body.name };
  }
  return successResponse({ id: inviteId }, { requestId, status: 201 });
}
