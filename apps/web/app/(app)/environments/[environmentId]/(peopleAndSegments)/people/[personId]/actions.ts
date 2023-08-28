"use server";

import { deletePerson } from "@formbricks/lib/services/person";

export const deletePersonAction = async (personId: string) => {
  await deletePerson(personId);
};
