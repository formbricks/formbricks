import { getServerSession } from "next-auth";
import { DEFAULT_SERVER_ERROR_MESSAGE, createSafeActionClient } from "next-safe-action";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { authOptions } from "../authOptions";
import { getUser } from "../user/service";

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (
      e instanceof ResourceNotFoundError ||
      e instanceof AuthorizationError ||
      e instanceof AuthenticationError
    ) {
      throw e;
    }
    throw new Error(DEFAULT_SERVER_ERROR_MESSAGE);
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
