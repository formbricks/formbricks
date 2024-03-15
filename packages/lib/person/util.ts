import { TPerson } from "@formbricks/types/people";

export const getPersonIdentifier = (person: TPerson): string | number | null => {
  return person.attributes.email || person.userId;
};
