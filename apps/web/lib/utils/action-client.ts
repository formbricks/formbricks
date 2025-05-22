import { AUDIT_LOG_ENABLED, AUDIT_LOG_GET_USER_IP } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { authOptions } from "@/modules/auth/lib/authOptions";
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
  UnknownError,
} from "@formbricks/types/errors";

export const actionClient = createSafeActionClient({
  handleServerError(e, utils) {
    const eventId = (utils.ctx as Record<string, any>)?.eventId;

    console.log("----------------------- eventId", eventId);

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
      e instanceof OperationNotAllowedError
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
  const ctx: Record<string, any> = { eventId };

  if (AUDIT_LOG_ENABLED && AUDIT_LOG_GET_USER_IP) {
    const ipAddress = await getClientIpFromHeaders();
    ctx.ipAddress = ipAddress;

    return next({ ctx });
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
