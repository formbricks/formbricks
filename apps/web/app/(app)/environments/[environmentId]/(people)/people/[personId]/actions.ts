"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { canUserAccessPerson, verifyUserRoleAccess } from "@formbricks/lib/person/auth";
import { deletePerson } from "@formbricks/lib/person/service";
import { AuthorizationError } from "@formbricks/types/errors";

export const deletePersonAction = async (environmentId: string, personId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessPerson(session.user.id, personId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const { hasDeleteAccess } = await verifyUserRoleAccess(environmentId, session.user.id);
  if (!hasDeleteAccess) throw new AuthorizationError("Not authorized");

  await deletePerson(personId);
};
