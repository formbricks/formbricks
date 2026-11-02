import { TContactAttributes } from "@formbricks/types/contact-attribute";

export const getContactIdentifier = (contactAttributes: TContactAttributes | null): string => {
  return contactAttributes?.email || contactAttributes?.userId || "";
};
