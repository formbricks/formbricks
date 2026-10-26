import * as Sentry from "@sentry/nextjs";
import { DEFAULT_SERVER_ERROR_MESSAGE, createSafeActionClient } from "next-safe-action";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@formbricks/logger";
import { AuthenticationError, AuthorizationError, isExpectedError } from "@formbricks/types/errors";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { AUDIT_LOG_ENABLED } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { getSession } from "@/modules/auth/lib/session";
import {
  UNKNOWN_AUDIT_REQUEST_METADATA,
  getAuditRequestMetadata,
} from "@/modules/ee/audit-logs/lib/request-metadata";
import { ActionClientCtx } from "./types/context";

export const actionClient = createSafeActionClient({
  handleServerError(e, utils) {
    const eventId = (utils.ctx as Record<string, any>)?.auditLoggingCtx?.eventId ?? undefined; // keep explicit fallback

    if (isExpectedError(e)) {
      return e.message;
    }

    // Attribute to the signed-in user by opaque id only (ENG-2326); `user` is set by
    // `authenticatedActionClient`, so plain `actionClient` actions stay anonymous.
    const userId = (utils.ctx as { user?: { id?: string } } | undefined)?.user?.id;

    // Only capture unexpected errors to Sentry
    Sentry.captureException(e, {
      extra: {
        eventId,
      },
      ...(userId ? { user: { id: userId } } : {}),
    });

    logger.withContext({ eventId }).error(e, "SERVER ERROR");
    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
}).use(async ({ next }) => {
  // Create a unique event id
  const eventId = uuidv4();
  // Snapshot before the audit callback runs outside the request. Licence checks stay off this path.
  const requestMetadata = AUDIT_LOG_ENABLED
    ? await getAuditRequestMetadata()
    : UNKNOWN_AUDIT_REQUEST_METADATA;
  const ctx: ActionClientCtx = { auditLoggingCtx: { eventId, ...requestMetadata } };

  return next({ ctx });
});

export const authenticatedActionClient = actionClient.use(async ({ ctx, next }) => {
  const session = await getSession();
  if (!session?.user) {
    throw new AuthenticationError("Not authenticated");
  }

  const userId = session.user.id;

  const user = await getUser(userId);
  if (!user) {
    throw new AuthorizationError("User not found");
  }

  return withAuthorizationSurface("server_action", () => next({ ctx: { ...ctx, user } }));
});
