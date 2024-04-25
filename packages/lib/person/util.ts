import { TAttributes } from "@formbricks/types/attributes";
import { TPerson } from "@formbricks/types/people";

export const getPersonIdentifier = (person: TPerson, personAttributes: TAttributes | null): string | null => {
  return personAttributes?.email || person.userId;
};
