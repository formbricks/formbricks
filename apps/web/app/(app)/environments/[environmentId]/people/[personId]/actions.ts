"use server";

import { deletePerson } from "@formbricks/lib/person/service";

export const deletePersonAction = async (personId: string) => {
  await deletePerson(personId);
};
