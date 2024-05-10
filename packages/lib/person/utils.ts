import { TAttributes } from "@formbricks/types/attributes";
import { TResponsePerson } from "@formbricks/types/responses";

export const getPersonIdentifier = (
  person: TResponsePerson | null,
  personAttributes: TAttributes | null
): string => {
  return personAttributes?.email || person?.userId || "";
};
