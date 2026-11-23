import type { TContactAttributesInput } from "@formbricks/types/contact-attribute";
import type { TContactImportBody } from "@/app/api/internal/contacts/schemas";
import type {
  TContactAttributesResource,
  TContactImportResource,
  TContactPersonalLinkResource,
} from "@/app/api/internal/contacts/serializers";
import { buildApiUrl, sendApiRequest } from "@/modules/api/lib/internal-api-client";

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

/**
 * Import contacts from a CSV into the workspace. Answers the contacts written, or the columns whose values
 * don't fit their attribute's type (nothing written). No timeout: an import of thousands of records takes a
 * while, and the server finishes it either way.
 */
export const importContacts = (workspaceId: string, body: TContactImportBody) =>
  sendApiRequest<TContactImportResource>(buildApiUrl("/api/internal/contacts/imports", { workspaceId }), {
    method: "POST",
    body,
    timeoutMs: null,
  });
