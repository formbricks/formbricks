import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { DEFAULT_SERVER_ERROR_MESSAGE, createSafeActionClient } from "next-safe-action";
import { getUser } from "@formbricks/lib/user/service";
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
  handleServerError(e) {
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
    logger.error(e, "SERVER ERROR: ");
    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

export const authenticatedActionClient = actionClient.use(async ({ next }) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AuthenticationError("Not authenticated");
  }

  const userId = session.user.id;

  const user = await getUser(userId);
  if (!user) {
    throw new AuthorizationError("User not found");
  }

  return next({ ctx: { user } });
});
