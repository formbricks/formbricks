import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { TResponseContact } from "@formbricks/types/responses";

export const getContactIdentifier = (
  contact: TResponseContact | null,
  contactAttributes: TContactAttributes | null
): string => {
  return contactAttributes?.email || contact?.userId || "";
};
