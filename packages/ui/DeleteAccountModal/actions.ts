"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { deleteUser } from "@formbricks/lib/user/service";
import { AuthenticationError } from "@formbricks/types/errors";

export const deleteUserAction = async () => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not Authenticated");

  return await deleteUser(session.user.id);
};
