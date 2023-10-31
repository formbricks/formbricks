import { TPerson } from "@formbricks/types/people";

export const getPersonIdentifier = (person: TPerson): string | number | null => {
  return person?.attributes?.userId || person?.attributes?.email || person?.id || null;
};
