import { prisma } from "@formbricks/database";
import { ZId, ZString } from "@formbricks/types/common";
import { TContactAttributes, ZContactAttributes } from "@formbricks/types/contact-attribute";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { validateInputs } from "@/lib/utils/validate";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import {
  getContactAttributes,
  hasEmailAttribute,
  hasUserIdAttribute,
} from "@/modules/ee/contacts/lib/contact-attributes";

const deleteAttributes = async (
  contactId: string,
  currentAttributes: TContactAttributes,
  submittedAttributes: TContactAttributes,
  contactAttributeKeys: TContactAttributeKey[]
): Promise<void> => {
  const contactAttributeKeyMap = new Map(contactAttributeKeys.map((ack) => [ack.key, ack]));

  // Determine which attributes should be deleted (exist in DB but not in payload)
  const submittedKeys = new Set(Object.keys(submittedAttributes));
  const keysToDelete = Object.keys(currentAttributes).filter((key) => !submittedKeys.has(key));

  // Get attribute key IDs for deletion
  const attributeKeyIdsToDelete = keysToDelete
    .map((key) => contactAttributeKeyMap.get(key)?.id)
    .filter((id): id is string => !!id);

  if (attributeKeyIdsToDelete.length > 0) {
    await prisma.contactAttribute.deleteMany({
      where: {
        contactId,
        attributeKeyId: {
          in: attributeKeyIdsToDelete,
        },
      },
    });
  }
};

/**
 * Updates or creates contact attributes.
 *
 * @param contactId - The ID of the contact to update
 * @param userId - The user ID of the contact
 * @param environmentId - The environment ID
 * @param contactAttributesParam - The attributes to update/create
 * @param deleteRemovedAttributes - When true, deletes attributes that exist in DB but are not in the payload.
 * Use this for UI forms where all attributes are submitted. Default is false (merge behavior) for API calls.
 */
export const updateAttributes = async (
  contactId: string,
  userId: string,
  environmentId: string,
  contactAttributesParam: TContactAttributes,
  deleteRemovedAttributes: boolean = false
): Promise<{
  success: boolean;
  messages?: string[];
  ignoreEmailAttribute?: boolean;
  ignoreUserIdAttribute?: boolean;
}> => {
  validateInputs(
    [contactId, ZId],
    [userId, ZString],
    [environmentId, ZId],
    [contactAttributesParam, ZContactAttributes]
  );

  let ignoreEmailAttribute = false;
  let ignoreUserIdAttribute = false;
  const messages: string[] = [];

  // Fetch current attributes, contact attribute keys, and email/userId checks in parallel
  const [currentAttributes, contactAttributeKeys, existingEmailAttribute, existingUserIdAttribute] =
    await Promise.all([
      getContactAttributes(contactId),
      getContactAttributeKeys(environmentId),
      contactAttributesParam.email
        ? hasEmailAttribute(contactAttributesParam.email, environmentId, contactId)
        : Promise.resolve(null),
      contactAttributesParam.userId
        ? hasUserIdAttribute(contactAttributesParam.userId, environmentId, contactId)
        : Promise.resolve(null),
    ]);

  // Process email and userId existence early
  const emailExists = !!existingEmailAttribute;
  const userIdExists = !!existingUserIdAttribute;

  // Remove email and/or userId from attributes if they already exist on another contact
  let contactAttributes = { ...contactAttributesParam };

  // Determine what the final email and userId values will be after this update
  // Only consider a value as "submitted" if it was explicitly included in the attributes
  const emailWasSubmitted = "email" in contactAttributesParam;
  const userIdWasSubmitted = "userId" in contactAttributesParam;

  const submittedEmail = emailWasSubmitted ? contactAttributes.email?.trim() || "" : null;
  const submittedUserId = userIdWasSubmitted ? contactAttributes.userId?.trim() || "" : null;

  const currentEmail = currentAttributes.email || "";
  const currentUserId = currentAttributes.userId || "";

  // Calculate final values:
  // - If not submitted, keep current value
  // - If submitted but duplicate exists, keep current value
  // - If submitted and no duplicate, use submitted value
  const getFinalEmail = (): string => {
    if (submittedEmail === null) return currentEmail;
    if (emailExists) return currentEmail;
    return submittedEmail;
  };

  const getFinalUserId = (): string => {
    if (submittedUserId === null) return currentUserId;
    if (userIdExists) return currentUserId;
    return submittedUserId;
  };

  const finalEmail = getFinalEmail();
  const finalUserId = getFinalUserId();

  // Ensure at least one of email or userId will have a value after update
  if (!finalEmail && !finalUserId) {
    // If both would be empty, preserve the current values
    if (currentEmail) {
      contactAttributes.email = currentEmail;
    }
    if (currentUserId) {
      contactAttributes.userId = currentUserId;
    }
    messages.push("Either email or userId is required. The existing values were preserved.");
  }

  if (emailExists) {
    const { email: _email, ...rest } = contactAttributes;
    contactAttributes = rest;
    ignoreEmailAttribute = true;
  }

  if (userIdExists) {
    const { userId: _userId, ...rest } = contactAttributes;
    contactAttributes = rest;
    ignoreUserIdAttribute = true;
  }

  // Delete attributes that were removed (only when explicitly requested)
  // This is used by UI forms where all attributes are submitted
  // For API calls, we want merge behavior by default (only update passed attributes)
  // We use contactAttributes (not contactAttributesParam) because it includes validation adjustments
  // (e.g., preserving email/userId when both would be empty)
  if (deleteRemovedAttributes) {
    await deleteAttributes(contactId, currentAttributes, contactAttributes, contactAttributeKeys);
  }

  // Create lookup map for attribute keys
  const contactAttributeKeyMap = new Map(contactAttributeKeys.map((ack) => [ack.key, ack]));

  // Separate existing and new attributes in a single pass
  const { existingAttributes, newAttributes } = Object.entries(contactAttributes).reduce(
    (acc, [key, value]) => {
      const attributeKey = contactAttributeKeyMap.get(key);
      if (attributeKey) {
        acc.existingAttributes.push({ key, value, attributeKeyId: attributeKey.id });
      } else {
        acc.newAttributes.push({ key, value });
      }
      return acc;
    },
    { existingAttributes: [], newAttributes: [] } as {
      existingAttributes: { key: string; value: string; attributeKeyId: string }[];
      newAttributes: { key: string; value: string }[];
    }
  );

  if (emailExists) {
    messages.push("The email already exists for this environment and was not updated.");
  }

  if (userIdExists) {
    messages.push("The userId already exists for this environment and was not updated.");
  }

  // Update all existing attributes
  if (existingAttributes.length > 0) {
    await prisma.$transaction(
      existingAttributes.map(({ attributeKeyId, value }) =>
        prisma.contactAttribute.upsert({
          where: {
            contactId_attributeKeyId: {
              contactId,
              attributeKeyId,
            },
          },
          update: { value },
          create: {
            contactId,
            attributeKeyId,
            value,
          },
        })
      )
    );
  }

  // Then, try to create new attributes if any exist
  if (newAttributes.length > 0) {
    const totalAttributeClassesLength = contactAttributeKeys.length + newAttributes.length;

    if (totalAttributeClassesLength > MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT) {
      // Add warning to details about skipped attributes
      messages.push(
        `Could not create ${newAttributes.length} new attribute(s) as it would exceed the maximum limit of ${MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT} attribute classes. Existing attributes were updated successfully.`
      );
    } else {
      // Create new attributes since we're under the limit
      await prisma.$transaction(
        newAttributes.map(({ key, value }) =>
          prisma.contactAttributeKey.create({
            data: {
              key,
              type: "custom",
              environment: { connect: { id: environmentId } },
              attributes: {
                create: { contactId, value },
              },
            },
          })
        )
      );
    }
  }

  return {
    success: true,
    messages: messages.length > 0 ? messages : undefined,
    ignoreEmailAttribute,
    ignoreUserIdAttribute,
  };
};
