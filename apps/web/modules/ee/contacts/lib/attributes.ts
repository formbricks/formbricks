import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { TContactAttributesInput, ZContactAttributesInput } from "@formbricks/types/contact-attribute";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { ValidationError } from "@formbricks/types/errors";
import { formatSnakeCaseToTitleCase, isSafeIdentifier } from "@formbricks/types/safe-identifier";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { NULL_BYTE_REASON, hasNullByte } from "@/lib/utils/postgres-text";
import { retryOnDeadlock } from "@/lib/utils/prisma-deadlock";
import { validateInputs } from "@/lib/utils/validate";
import {
  getReservedFutureDefaultAttributeKeyIssue,
  isReservedFutureDefaultAttributeKey,
} from "@/modules/ee/contacts/lib/attribute-key-policy";
import { TAttributeUpdateMessage } from "@/modules/ee/contacts/lib/attribute-messages";
import { prepareNewSDKAttributeForStorage } from "@/modules/ee/contacts/lib/attribute-storage";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import {
  getContactAttributes,
  hasEmailAttribute,
  hasUserIdAttribute,
} from "@/modules/ee/contacts/lib/contact-attributes";
import {
  formatValidationError,
  validateAndParseAttributeValue,
} from "@/modules/ee/contacts/lib/validate-attribute-type";

/**
 * Total, locale-independent ordering of two strings by code unit.
 *
 * Deliberately NOT `localeCompare` (ENG-2252): this decides the order in which the attribute
 * transactions below take their row locks, and that order must be byte-identical on every server in
 * the fleet. `localeCompare` varies with the runtime's locale, so two pods could sort the same keys
 * differently, take locks in opposite orders, and reintroduce the deadlock this ordering prevents.
 */
const compareCodeUnits = (a: string, b: string): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

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

type TExistingAttributeWrite = {
  key: string;
  attributeKeyId: string;
  columns: { value: string; valueNumber: number | null; valueDate: Date | null };
};
type TNewAttributeWrite = { key: string; value: string | number };

/** `email` or `userId` as text, or null when the payload leaves it out. */
const toOptionalString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

/**
 * The attributes to write once the identity rules ran: an email or userId another contact already
 * holds is dropped, and the contact keeps at least one of the two.
 */
const resolveIdentityAttributes = ({
  coercedAttributes,
  contactAttributesParam,
  emailValue,
  userIdValue,
  currentAttributes,
  emailExists,
  userIdExists,
  messages,
}: {
  coercedAttributes: Record<string, string | number>;
  contactAttributesParam: TContactAttributesInput;
  emailValue: string | null;
  userIdValue: string | null;
  currentAttributes: Awaited<ReturnType<typeof getContactAttributes>>;
  emailExists: boolean;
  userIdExists: boolean;
  messages: TAttributeUpdateMessage[];
}) => {
  let ignoreEmailAttribute = false;
  let ignoreUserIdAttribute = false;
  let contactAttributes = { ...coercedAttributes };

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
    messages.push({ code: "email_or_userid_required", params: {} });
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

  return { contactAttributes, ignoreEmailAttribute, ignoreUserIdAttribute };
};

/** The attributes whose key exists (type-checked), and the ones that will create a key. */
const splitAttributesByKey = (
  contactAttributes: Record<string, string | number>,
  contactAttributeKeyMap: Map<string, Awaited<ReturnType<typeof getContactAttributeKeys>>[number]>,
  messages: TAttributeUpdateMessage[]
): { existingAttributes: TExistingAttributeWrite[]; newAttributes: TNewAttributeWrite[] } => {
  const existingAttributes: {
    key: string;
    attributeKeyId: string;
    columns: { value: string; valueNumber: number | null; valueDate: Date | null };
  }[] = [];
  const newAttributes: { key: string; value: string | number }[] = [];

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
        // Type mismatch - add structured error
        messages.push({
          code: "attribute_type_validation_error",
          params: {
            key,
            dataType: attributeKey.dataType,
            error: formatValidationError(validationResult.error),
          },
        });
      }
    } else {
      // New attribute - will detect type on creation
      newAttributes.push({ key, value });
    }
  }

  return { existingAttributes, newAttributes };
};

/**
 * Update all existing attributes with typed column values, locked in a deterministic order (ENG-2252),
 * with a bounded deadlock retry.
 */
const upsertExistingAttributes = async (
  contactId: string,
  workspaceId: string,
  existingAttributes: TExistingAttributeWrite[]
): Promise<void> => {
  const orderedExistingAttributes = [...existingAttributes].sort((a, b) =>
    compareCodeUnits(a.attributeKeyId, b.attributeKeyId)
  );
  await retryOnDeadlock(
    () =>
      prisma.$transaction(
        orderedExistingAttributes.map((attribute) => upsertAttributeValue(prisma, contactId, attribute))
      ),
    { operation: "updateAttributes.existingAttributes", contactId, workspaceId }
  );
};

/** Writes one typed value onto an attribute key, on the given client. */
const upsertAttributeValue = (
  client: Pick<Prisma.TransactionClient, "contactAttribute">,
  contactId: string,
  { attributeKeyId, columns }: TExistingAttributeWrite
) => {
  const values = { value: columns.value, valueNumber: columns.valueNumber, valueDate: columns.valueDate };
  return client.contactAttribute.upsert({
    where: { contactId_attributeKeyId: { contactId, attributeKeyId } },
    update: values,
    create: { contactId, attributeKeyId, ...values },
  });
};

/**
 * The new attribute keys that will be created: safe, unreserved and within the limit. The rest are
 * skipped and reported in `errors` or `messages`.
 */
const selectNewAttributesToCreate = ({
  workspaceId,
  newAttributes,
  existingKeyCount,
  messages,
  errors,
}: {
  workspaceId: string;
  newAttributes: TNewAttributeWrite[];
  existingKeyCount: number;
  messages: TAttributeUpdateMessage[];
  errors: TAttributeUpdateMessage[];
}): TNewAttributeWrite[] => {
  // Validate that new attribute keys are safe identifiers
  const validNewAttributes: typeof newAttributes = [];
  const invalidKeys: string[] = [];
  const reservedKeys: string[] = [];

  for (const attr of newAttributes) {
    if (!isSafeIdentifier(attr.key)) {
      invalidKeys.push(attr.key);
    } else if (isReservedFutureDefaultAttributeKey(attr.key)) {
      reservedKeys.push(attr.key);
    } else {
      validNewAttributes.push(attr);
    }
  }

  // Add error message for invalid keys
  if (invalidKeys.length > 0) {
    errors.push({
      code: "invalid_attribute_keys",
      params: { keys: invalidKeys.join(", ") },
    });
    logger.warn({ workspaceId, invalidKeys }, "SDK tried to create attributes with invalid keys - skipping");
  }

  if (reservedKeys.length > 0) {
    errors.push({
      code: "reserved_attribute_keys",
      params: { issue: getReservedFutureDefaultAttributeKeyIssue(reservedKeys) },
    });
    logger.warn(
      { workspaceId, reservedKeys },
      "SDK tried to create reserved future default attribute keys - skipping"
    );
  }

  if (validNewAttributes.length === 0) return [];

  if (existingKeyCount + validNewAttributes.length > MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT) {
    // Add warning to details about skipped attributes
    messages.push({
      code: "attribute_limit_exceeded",
      params: {
        count: validNewAttributes.length.toString(),
        limit: MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT.toString(),
      },
    });
    return [];
  }

  return validNewAttributes;
};

/**
 * Refuses a value that holds a NULL byte (ENG-4019): Postgres `text` cannot store U+0000, so it would
 * fail the write with 22021 and a 500. Called only on values that would reach Postgres, so a value
 * under a key that is skipped anyway (invalid, reserved, over the limit, wrong type, dropped) still
 * leaves the rest of the request to go through, as it did before.
 */
const assertNoNullByte = (key: string, value: unknown): void => {
  if (typeof value === "string" && hasNullByte(value)) {
    throw new ValidationError(`Attribute ${JSON.stringify(key)} ${NULL_BYTE_REASON}`);
  }
};

/** A raced key vanished before the re-read; retried once. */
class RacedKeyVanishedError extends Error {}

const NEW_KEYS_MAX_ATTEMPTS = 2;

/**
 * Creates the new keys with this contact's values, converging when a concurrent identify call
 * creates one first (ENG-4018): `skipDuplicates` turns the lost `(key, workspaceId)` race into a
 * skipped row instead of a 500 (as in `contacts.ts`, `formbricks-file/resolve.ts`), and skipped
 * keys are re-read and type-checked like existing keys. Keys and values commit together, in a
 * deterministic order (ENG-2252), with a bounded deadlock retry.
 */
const createAttributeKeysAndValues = async ({
  contactId,
  workspaceId,
  newAttributes,
  messages,
}: {
  contactId: string;
  workspaceId: string;
  newAttributes: TNewAttributeWrite[];
  messages: TAttributeUpdateMessage[];
}): Promise<void> => {
  // Prepare new attributes with SDK-specific type detection
  const orderedNewAttributes = newAttributes
    .map(({ key, value }) => ({ key, value, ...prepareNewSDKAttributeForStorage(value) }))
    .sort((a, b) => compareCodeUnits(a.key, b.key));

  const writeKeysAndValues = async (tx: Prisma.TransactionClient) => {
    const createdKeys = await tx.contactAttributeKey.createManyAndReturn({
      data: orderedNewAttributes.map(({ key, dataType }) => ({
        key,
        name: formatSnakeCaseToTitleCase(key),
        type: "custom" as const,
        dataType,
        workspaceId,
      })),
      select: { id: true, key: true },
      skipDuplicates: true,
    });
    const createdKeyIds = new Map(createdKeys.map(({ key, id }) => [key, id]));

    const attributesToWrite: TExistingAttributeWrite[] = [];
    const racedAttributes: TNewAttributeWrite[] = [];
    for (const { key, value, columns } of orderedNewAttributes) {
      const attributeKeyId = createdKeyIds.get(key);
      if (attributeKeyId) attributesToWrite.push({ key, attributeKeyId, columns });
      else racedAttributes.push({ key, value });
    }

    const typeMessages: TAttributeUpdateMessage[] = [];
    if (racedAttributes.length > 0) {
      const racedKeys = await tx.contactAttributeKey.findMany({
        where: { workspaceId, key: { in: racedAttributes.map(({ key }) => key) } },
      });
      const { existingAttributes, newAttributes: vanishedAttributes } = splitAttributesByKey(
        Object.fromEntries(racedAttributes.map(({ key, value }) => [key, value])),
        new Map(racedKeys.map((attributeKey) => [attributeKey.key, attributeKey])),
        typeMessages
      );
      if (vanishedAttributes.length > 0) throw new RacedKeyVanishedError();
      attributesToWrite.push(...existingAttributes);
    }

    attributesToWrite.sort((a, b) => compareCodeUnits(a.attributeKeyId, b.attributeKeyId));
    for (const attribute of attributesToWrite) {
      await upsertAttributeValue(tx, contactId, attribute);
    }
    return { createdKeyIds, racedCount: racedAttributes.length, typeMessages };
  };

  for (let attempt = 1; ; attempt++) {
    try {
      const { createdKeyIds, racedCount, typeMessages } = await retryOnDeadlock(
        () => prisma.$transaction(writeKeysAndValues),
        { operation: "updateAttributes.newAttributeKeys", contactId, workspaceId }
      );
      for (const { key, dataType } of orderedNewAttributes.filter(({ key }) => createdKeyIds.has(key))) {
        logger.info({ workspaceId, attributeKey: key, dataType }, "Created new contact attribute");
        messages.push({ code: "new_attribute_created", params: { key, dataType } });
      }
      if (racedCount > 0) {
        logger.warn({ contactId, workspaceId, racedCount }, "Wrote onto raced contact attribute keys");
      }
      messages.push(...typeMessages);
      return;
    } catch (error) {
      if (!(error instanceof RacedKeyVanishedError) || attempt >= NEW_KEYS_MAX_ATTEMPTS) throw error;
    }
  }
};

/**
 * Updates or creates contact attributes.
 *
 * @param contactId - The ID of the contact to update
 * @param userId - The user ID of the contact
 * @param workspaceId - The workspace ID
 * @param contactAttributesParam - The attributes to update/create
 * @param deleteRemovedAttributes - When true, deletes attributes that exist in DB but are not in the payload.
 * Use this for UI forms where all attributes are submitted. Default is false (merge behavior) for API calls.
 */
export const updateAttributes = async (
  contactId: string,
  userId: string,
  workspaceId: string,
  contactAttributesParam: TContactAttributesInput,
  deleteRemovedAttributes: boolean = false
): Promise<{
  success: boolean;
  messages?: TAttributeUpdateMessage[];
  errors?: TAttributeUpdateMessage[];
  ignoreEmailAttribute?: boolean;
  ignoreUserIdAttribute?: boolean;
}> => {
  validateInputs(
    [contactId, ZId],
    [userId, ZString],
    [workspaceId, ZId],
    [contactAttributesParam, ZContactAttributesInput]
  );

  const messages: TAttributeUpdateMessage[] = [];
  const errors: TAttributeUpdateMessage[] = [];

  // Coerce boolean values to strings (SDK may send booleans for string attributes)
  const coercedAttributes: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(contactAttributesParam)) {
    coercedAttributes[key] = typeof value === "boolean" ? String(value) : value;
  }

  const emailValue = toOptionalString(contactAttributesParam.email);
  const userIdValue = toOptionalString(contactAttributesParam.userId);

  // Both are looked up below, and a NULL byte fails the lookup itself.
  assertNoNullByte("email", emailValue);
  assertNoNullByte("userId", userIdValue);

  // Fetch current attributes, contact attribute keys, and email/userId checks in parallel
  const [currentAttributes, contactAttributeKeys, existingEmailAttribute, existingUserIdAttribute] =
    await Promise.all([
      getContactAttributes(contactId),
      getContactAttributeKeys(workspaceId),
      emailValue ? hasEmailAttribute(emailValue, workspaceId, contactId) : Promise.resolve(null),
      userIdValue ? hasUserIdAttribute(userIdValue, workspaceId, contactId) : Promise.resolve(null),
    ]);

  // Process email and userId existence early
  const emailExists = !!existingEmailAttribute;
  const userIdExists = !!existingUserIdAttribute;

  // Remove email and/or userId from attributes if they already exist on another contact
  const { contactAttributes, ignoreEmailAttribute, ignoreUserIdAttribute } = resolveIdentityAttributes({
    coercedAttributes,
    contactAttributesParam,
    emailValue,
    userIdValue,
    currentAttributes,
    emailExists,
    userIdExists,
    messages,
  });

  // Create lookup map for attribute keys
  const contactAttributeKeyMap = new Map(contactAttributeKeys.map((ack) => [ack.key, ack]));

  // Separate existing and new attributes, validating types for existing attributes
  const { existingAttributes, newAttributes } = splitAttributesByKey(
    contactAttributes,
    contactAttributeKeyMap,
    messages
  );

  const newAttributesToCreate = selectNewAttributesToCreate({
    workspaceId,
    newAttributes,
    existingKeyCount: contactAttributeKeys.length,
    messages,
    errors,
  });

  // Checked before any write, so a refused request changes nothing.
  for (const { key, columns } of existingAttributes) assertNoNullByte(key, columns.value);
  for (const { key, value } of newAttributesToCreate) assertNoNullByte(key, value);

  // Delete attributes that were removed (only when explicitly requested)
  // This is used by UI forms where all attributes are submitted
  // For API calls, we want merge behavior by default (only update passed attributes)
  if (deleteRemovedAttributes) {
    await deleteAttributes(contactId, currentAttributes, contactAttributesParam, contactAttributeKeys);
  }

  if (emailExists) {
    messages.push({ code: "email_already_exists", params: {} });
  }

  if (userIdExists) {
    messages.push({ code: "userid_already_exists", params: {} });
  }

  // Update all existing attributes with typed column values.
  //
  // Lock in a deterministic order (ENG-2252): concurrent identify calls for the same contact send the
  // same keys in whatever order the caller's payload carries, and the upserts acquire the
  // ContactAttribute row locks in exactly that order — so two payloads with opposite key order form a
  // lock cycle and Postgres aborts one with SQLSTATE 40P01 ("deadlock detected"). Sorting by
  // attributeKeyId (the locked rows' identity — contactId is constant here) makes every transaction
  // take the locks in the same order, so no cycle can form between identify calls. The bounded retry
  // covers what ordering can't: collisions with other write paths touching the same rows. Both are
  // safe because a deadlock rolls the whole transaction back and the upserts are idempotent.
  if (existingAttributes.length > 0) {
    await upsertExistingAttributes(contactId, workspaceId, existingAttributes);
  }

  // Then create the new attributes, if any survived the checks
  if (newAttributesToCreate.length > 0) {
    await createAttributeKeysAndValues({
      contactId,
      workspaceId,
      newAttributes: newAttributesToCreate,
      messages,
    });
  }

  return {
    success: true,
    messages: messages.length > 0 ? messages : undefined,
    errors: errors.length > 0 ? errors : undefined,
    ignoreEmailAttribute,
    ignoreUserIdAttribute,
  };
};
