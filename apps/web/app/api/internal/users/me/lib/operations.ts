import "server-only";
import { headers } from "next/headers";
import {
  AuthenticationError,
  AuthorizationError,
  OperationNotAllowedError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import type { TUser } from "@formbricks/types/user";
import {
  getNotificationSettingsView,
  updateNotificationSetting,
} from "@/app/(app)/workspaces/[workspaceId]/settings/account/notifications/lib/notification-settings";
import { applyRateLimitOrRespond, rateLimitedResponse } from "@/app/api/internal/lib/rate-limit";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  noContentResponse,
  problemBadRequest,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { PASSWORD_RESET_DISABLED, WEBAPP_URL } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { requestSsoAccountDeletionEmail } from "@/modules/account/lib/better-auth-account-deletion-request";
import { auth } from "@/modules/auth/lib/auth";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TNotificationSettingPatchBody, TProfilePatchBody } from "../schemas";
import { updateOwnProfile } from "./profile";

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/**
 * The signed-in user, read fresh. Everything under `/api/internal/users/me` acts on the caller's own
 * account and nobody else's, so there is no id in the path to authorize — the session is the authorization.
 */
async function requireCurrentUser({
  authentication,
  requestId,
  instance,
}: TRequestContext): Promise<Response | TUser> {
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);
  const user = await getUser(actor.id);
  if (!user) return problemUnauthorized(requestId, "Session required", instance);
  return user;
}

/**
 * `PATCH /api/internal/users/me`: change your own name, locale or email address. Answers 204 with no body:
 * the stored profile would show whether a requested address was free (with verification off, a free one
 * changes at once and a taken one silently doesn't), which is the account oracle the email change avoids.
 */
export async function updateProfileOperation({
  body,
  ...context
}: TRequestContext & { body: TProfilePatchBody }): Promise<Response> {
  const { auditLog, requestId, instance } = context;
  const user = await requireCurrentUser(context);
  if (user instanceof Response) return user;
  if (auditLog) {
    auditLog.targetId = user.id;
    auditLog.oldObject = user;
  }

  let updated: TUser;
  try {
    updated = await updateOwnProfile(user, body);
  } catch (error) {
    // The email-change budget (a few per hour) is spent inside `updateOwnProfile`.
    if (error instanceof TooManyRequestsError) return rateLimitedResponse(error, context);
    if (error instanceof OperationNotAllowedError) {
      return problemForbidden(
        requestId,
        "Your identity provider manages your name and email address.",
        instance
      );
    }
    if (error instanceof AuthenticationError) {
      return problemBadRequest(requestId, "Changing your email address needs your current password.", {
        instance,
        invalid_params: [{ name: "password", reason: "Required to change the email address." }],
      });
    }
    if (error instanceof AuthorizationError) {
      return problemForbidden(requestId, "Incorrect credentials", instance);
    }
    throw error;
  }

  if (auditLog) auditLog.newObject = updated;
  return noContentResponse({ requestId });
}

/** `GET /api/internal/users/me/notification-settings`: every switch on the notifications page. */
export async function getNotificationSettingsOperation(context: TRequestContext): Promise<Response> {
  const user = await requireCurrentUser(context);
  if (user instanceof Response) return user;
  const view = await getNotificationSettingsView(user.id);
  if (!view) return problemUnauthorized(context.requestId, "Session required", context.instance);
  return successResponse(view.settings, { requestId: context.requestId });
}

/** `PATCH /api/internal/users/me/notification-settings`: flip one switch. Returns every switch. */
export async function updateNotificationSettingOperation({
  body,
  ...context
}: TRequestContext & { body: TNotificationSettingPatchBody }): Promise<Response> {
  const { auditLog, requestId, instance } = context;
  const user = await requireCurrentUser(context);
  if (user instanceof Response) return user;

  const result = await updateNotificationSetting(user.id, body);
  if (!result) return problemUnauthorized(requestId, "Session required", instance);

  if (auditLog) {
    auditLog.targetId = user.id;
    auditLog.oldObject = { notificationSettings: result.before };
    auditLog.newObject = { notificationSettings: result.after };
  }
  return successResponse(result.after, { requestId });
}

/**
 * `POST /api/internal/users/me/password-resets`: email yourself a password reset link. The page signs you
 * out afterwards. Credential accounts only; an SSO account has no password to reset.
 */
export async function requestPasswordResetOperation(context: TRequestContext): Promise<Response> {
  const { auditLog, requestId, instance } = context;
  const user = await requireCurrentUser(context);
  if (user instanceof Response) return user;
  if (auditLog) auditLog.targetId = user.id;

  if (PASSWORD_RESET_DISABLED) {
    return problemForbidden(requestId, "Password reset is disabled", instance);
  }
  if (user.identityProvider !== "email") {
    return problemForbidden(requestId, "Password reset is not allowed for this user.", instance);
  }

  // Without a limit this was the one way to have reset emails sent unbounded. A budget of its own, so
  // strangers spending forgot-password's per-account budget cannot lock the user out of this one.
  const limited = await applyRateLimitOrRespond(
    rateLimitConfigs.actions.passwordResetRequest,
    user.id,
    context
  );
  if (limited) return limited;

  await auth.api.requestPasswordReset({
    body: { email: user.email, redirectTo: `${WEBAPP_URL}/auth/forgot-password/reset` },
    headers: await headers(),
  });
  return successResponse({ emailSent: true }, { requestId, status: 202 });
}

/**
 * `POST /api/internal/users/me/deletion-requests`: for an SSO account, email the link that confirms
 * deleting it (ENG-1054 §14). Credential accounts delete through Better Auth with their password instead.
 * Shares the account-deletion rate limit.
 */
export async function requestAccountDeletionOperation(context: TRequestContext): Promise<Response> {
  const user = await requireCurrentUser(context);
  if (user instanceof Response) return user;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.accountDeletion, user.id, context);
  if (limited) return limited;
  try {
    await requestSsoAccountDeletionEmail();
  } catch (error) {
    // A credential account: it confirms deletion with its password, never by email link.
    if (error instanceof AuthorizationError) {
      return problemForbidden(
        context.requestId,
        "Password confirmation is required to delete this account.",
        context.instance
      );
    }
    throw error;
  }
  return successResponse({ emailSent: true }, { requestId: context.requestId, status: 202 });
}
