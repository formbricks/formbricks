import { prisma } from "@formbricks/database";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import {
  whereAttributeKeysOfDirectory,
  whereDirectoryAttributeKey,
} from "@/modules/ee/contacts/lib/attribute-key-scope";
import { readAttributeValue } from "@/modules/ee/contacts/lib/attribute-storage";
import {
  ContactDirectoryMissingError,
  type TWorkspaceContactDirectory,
  withWorkspaceDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";
import {
  TContactCreateRequest,
  TContactResponse,
  getUniqueValueKey,
} from "@/modules/ee/contacts/types/contact";

/** A contact of the directory whose `key` attribute is `value`, if any. */
const findContactWithAttribute = (directoryId: string, key: string, value: string) =>
  prisma.contact.findFirst({
    where: {
      directoryId,
      attributes: { some: { attributeKey: whereDirectoryAttributeKey(directoryId, key), value } },
    },
    select: { id: true },
  });

/**
 * Creates a contact in `directory`, from the request's workspace. The directory's matching key (`email`
 * or `userId`) is required and, like the other of the two keys when given, must not belong to another
 * contact of the directory.
 */
export const createContact = async (
  contactData: TContactCreateRequest,
  directory: TWorkspaceContactDirectory
): Promise<Result<TContactResponse, ApiErrorResponseV2>> => {
  const { workspaceId, attributes } = contactData;
  const identityKey = directory.matchingKey;

  try {
    const identityValue = attributes[identityKey];
    if (!identityValue) {
      return err({
        type: "bad_request",
        details: [{ field: "attributes", issue: `${identityKey} attribute is required` }],
      });
    }

    if (await findContactWithAttribute(directory.id, identityKey, identityValue)) {
      return err({
        type: "conflict",
        details: [{ field: identityKey, issue: `contact with this ${identityKey} already exists` }],
      });
    }

    // userId in an email directory, email in a userId one
    const uniqueValueKey = getUniqueValueKey(identityKey);
    const uniqueValue = attributes[uniqueValueKey];
    if (uniqueValue && (await findContactWithAttribute(directory.id, uniqueValueKey, uniqueValue))) {
      return err({
        type: "conflict",
        details: [{ field: uniqueValueKey, issue: `contact with this ${uniqueValueKey} already exists` }],
      });
    }

    // Get all attribute keys that need to exist
    const attributeKeys = Object.keys(attributes);

    // Check which attribute keys exist in the directory
    const existingAttributeKeys = await prisma.contactAttributeKey.findMany({
      where: {
        ...whereAttributeKeysOfDirectory(directory.id),
        key: { in: attributeKeys },
      },
    });

    const existingKeySet = new Set(existingAttributeKeys.map((key) => key.key));

    // Identify missing attribute keys
    const missingKeys = attributeKeys.filter((key) => !existingKeySet.has(key));

    // If any keys are missing, return an error
    if (missingKeys.length > 0) {
      return err({
        type: "bad_request",
        details: [{ field: "attributes", issue: `attribute keys not found: ${missingKeys.join(", ")}. ` }],
      });
    }

    const attributeData = Object.entries(attributes).map(([key, value]) => {
      const attributeKey = existingAttributeKeys.find((ak) => ak.key === key)!;
      return {
        attributeKeyId: attributeKey.id,
        value,
      };
    });

    // Under the workspace's lock, and only while `directory` is still its directory: a removal that
    // committed after the checks above refuses the insert instead of leaving the contact behind.
    const result = await withWorkspaceDirectory(
      workspaceId,
      (tx) =>
        tx.contact.create({
          data: {
            // The directory owns the contact; the workspace records where it was created.
            directoryId: directory.id,
            workspaceId,
            attributes: {
              createMany: {
                data: attributeData,
              },
            },
          },
          select: {
            id: true,
            createdAt: true,
            attributes: {
              include: {
                attributeKey: true,
              },
            },
          },
        }),
      { expectedDirectoryId: directory.id }
    );

    // Format the response with flattened attributes, resolving from typed columns
    const flattenedAttributes: Record<string, string> = {};
    result.attributes.forEach((attr) => {
      flattenedAttributes[attr.attributeKey.key] = readAttributeValue(attr, attr.attributeKey.dataType);
    });

    const response: TContactResponse = {
      id: result.id,
      createdAt: result.createdAt,
      workspaceId,
      attributes: flattenedAttributes,
    };

    return ok(response);
  } catch (error) {
    if (error instanceof ContactDirectoryMissingError) {
      return err({ type: "forbidden", details: [{ field: "workspaceId", issue: error.message }] });
    }
    return err({
      type: "internal_server_error",
      details: [
        { field: "contact", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
};
