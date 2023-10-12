"use server";

import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";
import { deletePerson } from "@formbricks/lib/person/service";
import { canUserAccessPerson } from "@formbricks/lib/person/auth";

export const deletePersonAction = async (personId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessPerson(session.user.id, personId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  await deletePerson(personId);
};
