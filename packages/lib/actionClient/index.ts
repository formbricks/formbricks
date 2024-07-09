import { getServerSession } from "next-auth";
import { DEFAULT_SERVER_ERROR_MESSAGE, createSafeActionClient } from "next-safe-action";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { authOptions } from "../authOptions";

export const actionClient = createSafeActionClient({
  handleReturnedServerError(e) {
    if (e instanceof ResourceNotFoundError) {
      return e.message;
    } else if (e instanceof AuthorizationError) {
      return e.message;
    }

    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

export const authenticatedActionClient = actionClient.use(async ({ next }) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AuthenticationError("Not authenticated");
  }
  return next({ ctx: { user: session.user } });
});
