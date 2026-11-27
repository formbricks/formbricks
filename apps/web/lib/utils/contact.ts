import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { TResponseContact } from "@formbricks/types/responses";

/**
 * The email saved on the response, else the contact's userId. A contact the workspace no longer reaches
 * comes without its userId, so the userId saved on the response stands in.
 */
export const getContactIdentifier = (
  contact: TResponseContact | null,
  contactAttributes: TContactAttributes | null
): string => {
  return contactAttributes?.email || contact?.userId || contactAttributes?.userId || "";
};
