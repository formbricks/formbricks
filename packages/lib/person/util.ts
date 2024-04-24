import { TAttributes } from "@formbricks/types/attributes";
import { TPerson } from "@formbricks/types/people";

export const getPersonIdentifier = (person: TPerson, attributes: TAttributes): string | number | null => {
  return attributes.email || person.userId;
};
