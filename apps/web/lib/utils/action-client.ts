import { AUDIT_LOG_ENABLED, AUDIT_LOG_GET_USER_IP } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { DEFAULT_SERVER_ERROR_MESSAGE, createSafeActionClient } from "next-safe-action";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@formbricks/logger";
import {
  AuthenticationError,
  AuthorizationError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
  UnknownError,
} from "@formbricks/types/errors";
import { TUser } from "@formbricks/types/user";

export type AuditLoggingCtx = {
  organizationId?: string;
  ipAddress: string;
  segmentId?: string;
  surveyId?: string;
  oldObject?: any;
  newObject?: any;
  eventId?: string;
};

export type ActionClientCtx = {
  auditLoggingCtx: AuditLoggingCtx;
  user?: TUser;
};

export const actionClient = createSafeActionClient({
  handleServerError(e, utils) {
    const eventId = (utils.ctx as Record<string, any>)?.auditLoggingCtx?.eventId ?? undefined; // keep explicit fallback
    Sentry.captureException(e, {
      extra: {
        eventId,
      },
    });

    if (
      e instanceof ResourceNotFoundError ||
      e instanceof AuthorizationError ||
      e instanceof InvalidInputError ||
      e instanceof UnknownError ||
      e instanceof AuthenticationError ||
      e instanceof OperationNotAllowedError ||
      e instanceof TooManyRequestsError
    ) {
      return e.message;
    }

    // eslint-disable-next-line no-console -- This error needs to be logged for debugging server-side errors
    logger.withContext({ eventId }).error(e, "SERVER ERROR");
    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
}).use(async ({ next }) => {
  // Create a unique event id
  const eventId = uuidv4();
  const ctx: ActionClientCtx = { auditLoggingCtx: { eventId, ipAddress: UNKNOWN_DATA } };

  if (AUDIT_LOG_ENABLED && AUDIT_LOG_GET_USER_IP) {
    try {
      const ipAddress = await getClientIpFromHeaders();
      ctx.auditLoggingCtx.ipAddress = ipAddress;
    } catch (err) {
      // Non-fatal – we keep UNKNOWN_DATA
      logger.warn({ err }, "Failed to resolve client IP for audit logging");
    }
  }

  return next({ ctx });
});

export const authenticatedActionClient = actionClient.use(async ({ ctx, next }) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AuthenticationError("Not authenticated");
  }

  const userId = session.user.id;

  const user = await getUser(userId);
  if (!user) {
    throw new AuthorizationError("User not found");
  }

  return next({ ctx: { ...ctx, user } });
});
