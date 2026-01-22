import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import {
  TContactAttributes,
  TContactAttributesInput,
  ZContactAttributesInput,
} from "@formbricks/types/contact-attribute";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { validateInputs } from "@/lib/utils/validate";
import { prepareNewSDKAttributeForStorage } from "@/modules/ee/contacts/lib/attribute-storage";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import {
  getContactAttributes,
  hasEmailAttribute,
  hasUserIdAttribute,
} from "@/modules/ee/contacts/lib/contact-attributes";
import { validateAndParseAttributeValue } from "@/modules/ee/contacts/lib/validate-attribute-type";

// Default/system attributes that should not be deleted even if missing from payload
const DEFAULT_ATTRIBUTES = new Set(["email", "userId", "firstName", "lastName"]);

const deleteAttributes = async (
  contactId: string,
  currentAttributes: TContactAttributesInput,
  submittedAttributes: TContactAttributesInput,
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
  contactAttributesParam: TContactAttributesInput,
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
    [contactAttributesParam, ZContactAttributesInput]
  );

  let ignoreEmailAttribute = false;
  let ignoreUserIdAttribute = false;
  const messages: string[] = [];

  // Convert email and userId to strings for lookup (they should always be strings, but handle numbers gracefully)
  const emailValue =
    contactAttributesParam.email === null || contactAttributesParam.email === undefined
      ? null
      : String(contactAttributesParam.email);
  const userIdValue =
    contactAttributesParam.userId === null || contactAttributesParam.userId === undefined
      ? null
      : String(contactAttributesParam.userId);

  // Fetch current attributes, contact attribute keys, and email/userId checks in parallel
  const [currentAttributes, contactAttributeKeys, existingEmailAttribute, existingUserIdAttribute] =
    await Promise.all([
      getContactAttributes(contactId),
      getContactAttributeKeys(environmentId),
      emailValue ? hasEmailAttribute(emailValue, environmentId, contactId) : Promise.resolve(null),
      userIdValue ? hasUserIdAttribute(userIdValue, environmentId, contactId) : Promise.resolve(null),
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

  const submittedEmail = emailWasSubmitted ? emailValue?.trim() || "" : null;
  const submittedUserId = userIdWasSubmitted ? userIdValue?.trim() || "" : null;

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
  if (deleteRemovedAttributes) {
    await deleteAttributes(contactId, currentAttributes, contactAttributesParam, contactAttributeKeys);
  }

  // Create lookup map for attribute keys
  const contactAttributeKeyMap = new Map(contactAttributeKeys.map((ack) => [ack.key, ack]));

  // Separate existing and new attributes, validating types for existing attributes
  const existingAttributes: {
    key: string;
    attributeKeyId: string;
    columns: { value: string; valueNumber: number | null; valueDate: Date | null };
  }[] = [];
  const newAttributes: { key: string; value: string | number }[] = [];
  const typeValidationErrors: string[] = [];

  for (const [key, value] of Object.entries(contactAttributes)) {
    const attributeKey = contactAttributeKeyMap.get(key);

    if (attributeKey) {
      // Existing attribute - validate type and prepare columns
      const validationResult = validateAndParseAttributeValue(value, attributeKey.dataType, key);

      if (validationResult.valid) {
        existingAttributes.push({
          key,
          attributeKeyId: attributeKey.id,
          columns: validationResult.parsedValue,
        });
      } else {
        // Type mismatch - add to errors and include what type is expected
        typeValidationErrors.push(
          `${validationResult.error} (attribute '${key}' has dataType: ${attributeKey.dataType})`
        );
      }
    } else {
      // New attribute - will detect type on creation
      newAttributes.push({ key, value });
    }
  }

  // Add type validation errors to messages
  if (typeValidationErrors.length > 0) {
    messages.push(...typeValidationErrors);
  }

  if (emailExists) {
    messages.push("The email already exists for this environment and was not updated.");
  }

  if (userIdExists) {
    messages.push("The userId already exists for this environment and was not updated.");
  }

  // Update all existing attributes with typed column values
  if (existingAttributes.length > 0) {
    await prisma.$transaction(
      existingAttributes.map(({ attributeKeyId, columns }) =>
        prisma.contactAttribute.upsert({
          where: {
            contactId_attributeKeyId: {
              contactId,
              attributeKeyId,
            },
          },
          update: {
            value: columns.value,
            valueNumber: columns.valueNumber,
            valueDate: columns.valueDate,
          },
          create: {
            contactId,
            attributeKeyId,
            value: columns.value,
            valueNumber: columns.valueNumber,
            valueDate: columns.valueDate,
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
      // Prepare new attributes with SDK-specific type detection
      const preparedNewAttributes = newAttributes.map(({ key, value }) => {
        const { dataType, columns } = prepareNewSDKAttributeForStorage(value);
        return { key, dataType, columns };
      });

      // Log new attribute creation with their types
      for (const { key, dataType } of preparedNewAttributes) {
        logger.info({ environmentId, attributeKey: key, dataType }, "Created new contact attribute");
        messages.push(`Created new attribute '${key}' with type '${dataType}'`);
      }

      // Create new attributes since we're under the limit
      await prisma.$transaction(
        preparedNewAttributes.map(({ key, dataType, columns }) =>
          prisma.contactAttributeKey.create({
            data: {
              key,
              type: "custom",
              dataType,
              environment: { connect: { id: environmentId } },
              attributes: {
                create: {
                  contactId,
                  value: columns.value,
                  valueNumber: columns.valueNumber,
                  valueDate: columns.valueDate,
                },
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
