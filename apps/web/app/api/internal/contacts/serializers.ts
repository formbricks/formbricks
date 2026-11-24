import type { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import type { TCreateContactsFromCSVResult } from "@/modules/ee/contacts/lib/contacts";

/**
 * The outcome of saving a contact's attributes: what the save could not take as sent, or the keys it created,
 * as codes the edit dialog translates. Empty when everything was saved as sent.
 */
export type TContactAttributesResource = {
  contactId: string;
  messages: { code: string; params: Record<string, string> }[];
};

/** A personal link to a survey for one contact. */
export type TContactPersonalLinkResource = {
  surveyUrl: string;
};

/**
 * The outcome of a CSV import: the contacts it created or updated (ids only; skipped duplicates are left
 * out), or, when nothing was written, the columns whose values don't fit their existing attribute's type.
 */
export type TContactImportResource =
  | { contacts: { id: string }[] }
  | {
      validationErrors: { key: string; dataType: TContactAttributeDataType; invalidValues: string[] }[];
    };

export const serializeContactImport = (result: TCreateContactsFromCSVResult): TContactImportResource =>
  "contacts" in result
    ? { contacts: result.contacts.map(({ id }) => ({ id })) }
    : {
        validationErrors: result.validationErrors.map(({ key, dataType, invalidValues }) => ({
          key,
          dataType,
          invalidValues,
        })),
      };
