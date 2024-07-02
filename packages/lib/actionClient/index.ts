import { getServerSession } from "next-auth";
import { DEFAULT_SERVER_ERROR_MESSAGE, createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { authOptions } from "../authOptions";

const ZResource = z.enum([
  "product",
  "organization",
  "environment",
  "membership",
  "invite",
  "response",
  "survey",
]);
const ZAction = z.enum(["create", "read", "update", "delete"]);

export type TResource = z.infer<typeof ZResource>;
export type TAction = z.infer<typeof ZAction>;

export const actionClient = createSafeActionClient({
  defineMetadataSchema() {
    return z.object({
      rules: z.tuple([ZResource, ZAction]),
    });
  },
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
