import "server-only";
import { TContactAttributes, TContactAttributesInput } from "@formbricks/types/contact-attribute";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TAttributeUpdateMessage, updateAttributes } from "./attributes";
import { getContactAttributeKeys } from "./contact-attribute-keys";
import { getContactAttributes } from "./contact-attributes";
import { getContact } from "./contacts";

export interface UpdateContactAttributesResult {
  updatedAttributes: TContactAttributes;
  messages?: TAttributeUpdateMessage[];
  updatedAttributeKeys?: TContactAttributeKey[];
}

export const updateContactAttributes = async (
  contactId: string,
  attributes: TContactAttributesInput
): Promise<UpdateContactAttributesResult> => {
  // Load contact to get environmentId and current attributes
  const contact = await getContact(contactId);
  if (!contact) {
    throw new ResourceNotFoundError("contact", contactId);
  }

  const environmentId = contact.environmentId;

  // Extract userId from attributes (required by updateAttributes)
  // If missing, pass empty string but note it in messages
  const userIdValue = attributes.userId;
  const userId = userIdValue === null || userIdValue === undefined ? "" : String(userIdValue);
  const messages: TAttributeUpdateMessage[] = [];

  // Get current attribute keys before update to detect new ones
  const currentAttributeKeys = await getContactAttributeKeys(environmentId);
  const currentKeysSet = new Set(currentAttributeKeys.map((key) => key.key));

  // Call updateAttributes with deleteRemovedAttributes: true
  // UI forms submit all attributes, so any missing attribute should be deleted
  const updateResult = await updateAttributes(contactId, userId, environmentId, attributes, true);

  // Merge any messages from updateAttributes
  if (updateResult.messages) {
    messages.push(...updateResult.messages);
  }

  // Fetch updated attributes
  const updatedAttributes = await getContactAttributes(contactId);

  // Detect if new keys were created by comparing before/after
  const updatedAttributeKeys = await getContactAttributeKeys(environmentId);
  const newKeys = updatedAttributeKeys.filter((key) => !currentKeysSet.has(key.key));

  return {
    updatedAttributes,
    messages: messages.length > 0 ? messages : undefined,
    updatedAttributeKeys: newKeys.length > 0 ? newKeys : undefined,
  };
};
