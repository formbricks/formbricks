import { TAttributes } from "@formbricks/types/attributes";
import { TResponseContact } from "@formbricks/types/responses";

export const getPersonIdentifier = (
  person: TResponseContact | null,
  personAttributes: TAttributes | null
): string => {
  return personAttributes?.email || person?.userId || "";
};
