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

// Default/system attributes that should not be deleted even if missing from payload
const DEFAULT_ATTRIBUTES = new Set(["email", "userId", "firstName", "lastName"]);

const deleteAttributes = async (
  contactId: string,
  currentAttributes: TContactAttributes,
  submittedAttributes: TContactAttributes,
  contactAttributeKeys: TContactAttributeKey[]
): Promise<{ success: boolean }> => {
  const contactAttributeKeyMap = new Map(contactAttributeKeys.map((ack) => [ack.key, ack]));

  // Determine which attributes should be deleted (exist in DB but not in payload, and not default attributes)
  const submittedKeys = new Set(Object.keys(submittedAttributes));
  const currentKeys = new Set(Object.keys(currentAttributes));
  const keysToDelete = Array.from(currentKeys).filter(
    (key) => !submittedKeys.has(key) && !DEFAULT_ATTRIBUTES.has(key)
  );

  // Get attribute key IDs for deletion
  const attributeKeyIdsToDelete = keysToDelete
    .map((key) => contactAttributeKeyMap.get(key)?.id)
    .filter((id): id is string => !!id);

  // Delete attributes that were removed from the form (but not default attributes)
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

  return {
    success: true,
  };
};

export const updateAttributes = async (
  contactId: string,
  userId: string,
  environmentId: string,
  contactAttributesParam: TContactAttributes
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

  // Delete attributes that were removed (using the deleteAttributes service)
  await deleteAttributes(contactId, currentAttributes, contactAttributesParam, contactAttributeKeys);

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

  const messages: string[] = [];

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
