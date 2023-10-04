import { TPerson } from "@formbricks/types/v1/people";

export const getPersonIdentifier = (person: TPerson): string | number | null => {
  return person?.attributes?.userId || person?.attributes?.email || person?.id || null;
};
