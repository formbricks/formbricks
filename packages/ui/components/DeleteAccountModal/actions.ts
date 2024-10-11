"use server";

import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { deleteUser } from "@formbricks/lib/user/service";

export const deleteUserAction = authenticatedActionClient.action(async ({ ctx }) => {
  return await deleteUser(ctx.user.id);
});
