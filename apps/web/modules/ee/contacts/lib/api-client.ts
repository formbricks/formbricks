import type { TContactAttributesInput } from "@formbricks/types/contact-attribute";
import type {
  TContactAttributesResource,
  TContactPersonalLinkResource,
} from "@/app/api/internal/contacts/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

const contactPath = (contactId: string) => `/api/internal/contacts/${encodeURIComponent(contactId)}`;

/** Delete a contact. */
export const deleteContact = (contactId: string) =>
  sendApiRequest<void>(contactPath(contactId), { method: "DELETE" });

/**
 * Replace a contact's attributes with the ones sent; one left out is removed. Answers what the save could
 * not take as sent, as codes to translate.
 */
export const updateContactAttributes = (contactId: string, attributes: TContactAttributesInput) =>
  sendApiRequest<TContactAttributesResource>(`${contactPath(contactId)}/attributes`, {
    method: "PUT",
    body: { attributes },
  });

/** A personal link to a survey for the contact. */
export const createContactPersonalLink = (contactId: string, surveyId: string) =>
  sendApiRequest<TContactPersonalLinkResource>(`${contactPath(contactId)}/personal-links`, {
    method: "POST",
    body: { surveyId },
  });
